import Anthropic from '@anthropic-ai/sdk';
import type { Idea, Piece, Project, Settings, Source } from './types';
import { FORMATS, formatById } from './formats';
import { uid } from './db';
import { blobToBase64, imageForApi } from './files';
import { formatDuration } from './youtube';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (recommended)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster, cheaper)' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1 (most capable, priciest)' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fastest)' },
];

type Block = Anthropic.Beta.BetaContentBlockParam;

/** Everything we know about a YouTube source, as text: metadata, description and (timestamped) transcript. */
function youtubeText(src: Source) {
  const y = src.youtube;
  const meta = [
    `YouTube video: ${src.title}${y?.author ? ` by ${y.author}` : ''}`,
    `URL: ${src.url}`,
    y?.publishedAt && `Published: ${y.publishedAt.slice(0, 10)}`,
    y?.views != null && `Views: ${y.views.toLocaleString('en-US')}`,
    y?.duration && `Duration: ${formatDuration(y.duration)}`,
  ].filter(Boolean);
  const parts = [meta.join('\n')];
  if (y?.description?.trim()) parts.push(`Description:\n${y.description.trim()}`);
  const transcript = src.text?.trim();
  parts.push(
    transcript
      ? `Transcript (timestamps in [m:ss]):\n${transcript}`
      : '(No transcript provided. Use only the metadata and description above; do not invent what happens in the video or cite timestamps for it.)',
  );
  return parts.join('\n\n');
}

async function sourceBlocks(src: Source, note: string | undefined): Promise<Block[]> {
  const context = note ? `How to use this source: ${note}` : undefined;
  const title = src.path || src.title;
  if (src.kind === 'image' && src.blob) {
    const img = await imageForApi(src.blob);
    return [
      { type: 'text', text: `Image source "${title}".${context ? ' ' + context : ''}` },
      { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } },
    ];
  }
  if (src.kind === 'pdf' && src.blob) {
    return [
      {
        type: 'document',
        title,
        context,
        source: { type: 'base64', media_type: 'application/pdf', data: await blobToBase64(src.blob) },
      },
    ];
  }
  const text = src.kind === 'youtube' ? youtubeText(src) : src.text?.trim() ?? '';
  if (!text) return [];
  return [{ type: 'document', title, context, source: { type: 'text', media_type: 'text/plain', data: text } }];
}

export interface GenerateRequest {
  settings: Settings;
  project: Project;
  piece: Piece;
  sources: Map<string, Source>;
  mode: 'generate' | 'refine';
  instruction?: string;
  variations: number;
  onText: (snapshot: string) => void;
  signal: AbortSignal;
}

export function buildSystem(project: Project) {
  return [
    'You are a senior copywriter and content strategist producing marketing content from the source material the user provides.',
    'Ground every claim in the sources or the guidelines; if a fact is missing, leave a clearly marked [PLACEHOLDER] rather than inventing it.',
    'Output only the finished content in Markdown. No preamble, no closing commentary.',
    project.guidelines.trim() && `\nProject guidelines (always follow):\n${project.guidelines.trim()}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildTask(piece: Piece, mode: GenerateRequest['mode'], instruction: string | undefined, variations: number) {
  const format = formatById(piece.format);
  const lines = [
    `Deliverable: ${format.id === 'custom' ? piece.title : format.label}`,
    format.guidance && `Format requirements: ${format.guidance}`,
    piece.brief && `Brief: ${piece.brief}`,
    piece.facts?.trim() && `Key facts & parameters (treat as true and must be reflected):\n${piece.facts.trim()}`,
    piece.audience && `Audience: ${piece.audience}`,
    piece.tone && `Tone: ${piece.tone}`,
    piece.length && `Length: ${piece.length}`,
  ].filter(Boolean);

  if (mode === 'refine') {
    return [
      ...lines,
      '',
      'Here is the current draft:',
      '<draft>',
      piece.body,
      '</draft>',
      '',
      `Revise the draft according to this instruction: ${instruction}`,
      'Keep everything the instruction does not ask you to change. Return the complete revised draft.',
    ].join('\n');
  }
  return [
    ...lines,
    '',
    variations > 1
      ? `Write ${variations} distinct variations, each under a "## Variation N" heading, taking meaningfully different angles.`
      : 'Write one polished version.',
  ].join('\n');
}

/** Streams a generation from Claude; resolves with the final text. */
export async function generate(req: GenerateRequest): Promise<{ text: string; model: string }> {
  const { settings, project, piece } = req;
  if (!settings.apiKey) throw new Error('Add your Anthropic API key in Settings first.');

  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });

  const content: Block[] = [];
  for (const ref of piece.sources) {
    const src = req.sources.get(ref.sourceId);
    if (src && !src.missing) content.push(...(await sourceBlocks(src, ref.note)));
  }
  content.push({ type: 'text', text: buildTask(piece, req.mode, req.instruction, req.variations) });

  const system = buildSystem(project);

  const params = requestParams(settings, system, content);

  return runStream(client, params, req.signal, req.onText);
}

function requestParams(settings: Settings, system: string, content: Block[]): Anthropic.Beta.MessageCreateParamsNonStreaming {
  const isHaiku = settings.model.startsWith('claude-haiku');
  const isFable = settings.model.startsWith('claude-fable');
  const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
    model: settings.model,
    max_tokens: isHaiku ? 32000 : 64000,
    system,
    messages: [{ role: 'user', content }],
  };
  if (!isHaiku) {
    params.output_config = { effort: settings.effort };
    // Re-runs a declined request on a suitable model instead of failing outright.
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
    if (!isFable) params.thinking = { type: 'adaptive' };
  }
  return params;
}

async function runStream(
  client: Anthropic,
  params: Anthropic.Beta.MessageCreateParamsNonStreaming,
  signal: AbortSignal,
  onText?: (snapshot: string) => void,
): Promise<{ text: string; model: string }> {
  const stream = client.beta.messages.stream(params, { signal });
  if (onText) stream.on('text', (_delta, snapshot) => onText(snapshot));
  const final = await stream.finalMessage();

  if (final.stop_reason === 'refusal') {
    throw new Error(`Claude declined this request${final.stop_details?.explanation ? `: ${final.stop_details.explanation}` : '.'}`);
  }
  const text = final.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (final.stop_reason === 'max_tokens') return { text: text + '\n\n[Output was cut off at the length limit]', model: final.model };
  return { text, model: final.model };
}

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'Your API key was rejected. Check it in Settings.';
  if (err instanceof Anthropic.RateLimitError) return 'Rate limited by the API. Wait a moment and try again.';
  if (err instanceof Anthropic.BadRequestError) return `The API rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIUserAbortError) return 'Generation stopped.';
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the Anthropic API. Check your connection.';
  if (err instanceof Anthropic.APIError) return `API error ${err.status}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

/**
 * Builds a single self-contained prompt to paste into Claude.ai (no API key needed).
 * Text sources are inlined; images and PDFs are listed so they can be attached in the chat.
 */
export function buildManualPrompt(req: Pick<GenerateRequest, 'project' | 'piece' | 'sources' | 'mode' | 'instruction' | 'variations'>) {
  const attachments: Source[] = [];
  const blocks: string[] = [];
  for (const ref of req.piece.sources) {
    const src = req.sources.get(ref.sourceId);
    if (!src || src.missing) continue;
    const title = src.path || src.title;
    const note = ref.note ? `\nHow to use this source: ${ref.note}` : '';
    if ((src.kind === 'image' || src.kind === 'pdf') && src.blob) {
      attachments.push(src);
      blocks.push(`<source title="${title}" type="${src.kind}">(attached to this message as a file)${note}</source>`);
      continue;
    }
    const text = src.kind === 'youtube' ? youtubeText(src) : src.text?.trim() ?? '';
    if (text) blocks.push(`<source title="${title}">${note}\n${text}\n</source>`);
  }
  const prompt = [
    buildSystem(req.project),
    blocks.length ? `\n<sources>\n${blocks.join('\n\n')}\n</sources>` : '',
    '\n' + buildTask(req.piece, req.mode, req.instruction, req.variations),
  ].join('\n');
  return { prompt, attachments };
}

// ---------- Auto: content recommendations ----------

export interface IdeasRequest {
  project: Project;
  videos: Source[];
  goal: string;
  count: number;
}

const IDEA_FORMATS = FORMATS.filter((f) => f.id !== 'custom');

/** One prompt that works both via the API and pasted into Claude.ai. */
export function buildIdeasPrompt({ project, videos, goal, count }: IdeasRequest) {
  const catalog = videos
    .map((v) => {
      const y = v.youtube;
      const bits = [
        `id=${y?.videoId}`,
        `"${v.title}"`,
        y?.publishedAt && `published ${y.publishedAt.slice(0, 10)}`,
        y?.views != null && `${y.views.toLocaleString('en-US')} views`,
        y?.duration && `length ${formatDuration(y.duration)}`,
        v.text?.trim() ? 'has transcript' : null,
      ].filter(Boolean);
      const desc = y?.description?.replace(/\s+/g, ' ').trim().slice(0, 280);
      const excerpt = v.text?.replace(/\s+/g, ' ').trim().slice(0, 400);
      return `- ${bits.join(' · ')}${desc ? `\n  Description: ${desc}` : ''}${excerpt ? `\n  Transcript excerpt: ${excerpt}` : ''}`;
    })
    .join('\n');

  return [
    'You are a content strategist for a YouTube channel. Using the channel catalog below, recommend content we should make next to grow views and engagement.',
    project.guidelines.trim() && `\nBrand guidelines:\n${project.guidelines.trim()}`,
    goal.trim() && `\nWhat is going on right now / what we want:\n${goal.trim()}`,
    `\nChannel catalog (${videos.length} videos, newest first):\n${catalog}`,
    `\nRecommend exactly ${count} ideas. Mix formats (promos and trailers, explainers, recaps, compilations, social cutdowns, ads, titles/descriptions) as the catalog and goal justify. Lean on videos with strong views and on anything timely. Each idea must use 1–8 videos from the catalog as source material, referenced by id.`,
    `\nAllowed format ids: ${IDEA_FORMATS.map((f) => `${f.id} (${f.label})`).join(', ')}.`,
    `\nReply with JSON only, no prose, in exactly this shape:
{"ideas":[{"title":"short name","format":"one of the format ids","why":"1–2 sentences: why this will work, citing views or timing","brief":"what the piece should do and the angle","facts":"hard facts to respect, from the goal/catalog","tone":"...","audience":"...","length":"...","videoIds":["id", "..."]}]}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Tolerant parse: accepts raw JSON, a fenced block, or JSON surrounded by stray text. */
export function parseIdeas(text: string, knownVideoIds: Set<string>): Idea[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  let data: unknown;
  try {
    data = JSON.parse(candidate);
  } catch {
    throw new Error("Couldn't read the recommendations. Make sure you pasted Claude's whole reply (it should be JSON).");
  }
  const list = Array.isArray(data) ? data : (data as { ideas?: unknown }).ideas;
  if (!Array.isArray(list) || !list.length) throw new Error('The reply had no ideas in it.');
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return list.map((raw) => {
    const r = raw as Record<string, unknown>;
    const format = FORMATS.some((f) => f.id === r.format) ? String(r.format) : 'custom';
    const videoIds = (Array.isArray(r.videoIds) ? r.videoIds : []).map(String).filter((id) => knownVideoIds.has(id));
    return {
      id: uid(),
      title: str(r.title) || 'Untitled idea',
      format,
      why: str(r.why),
      brief: str(r.brief),
      facts: str(r.facts),
      tone: str(r.tone),
      audience: str(r.audience),
      length: str(r.length),
      videoIds,
    };
  });
}

export async function recommendIdeas(settings: Settings, req: IdeasRequest, signal: AbortSignal): Promise<Idea[]> {
  if (!settings.apiKey) throw new Error('Add your Anthropic API key in Settings first.');
  const client = new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
  const params = requestParams(settings, 'You recommend content strategy. Reply with JSON only.', [{ type: 'text', text: buildIdeasPrompt(req) }]);
  const { text } = await runStream(client, params, signal);
  return parseIdeas(text, new Set(req.videos.map((v) => v.youtube!.videoId)));
}
