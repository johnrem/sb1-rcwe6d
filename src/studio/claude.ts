import Anthropic from '@anthropic-ai/sdk';
import type { Piece, Project, Settings, Source } from './types';
import { formatById } from './formats';
import { blobToBase64, imageForApi } from './files';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (recommended)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster, cheaper)' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1 (most capable, priciest)' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fastest)' },
];

type Block = Anthropic.Beta.BetaContentBlockParam;

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
  let text = src.text?.trim() ?? '';
  if (src.kind === 'youtube') {
    const header = `YouTube video: ${src.title}${src.youtube?.author ? ` by ${src.youtube.author}` : ''}\nURL: ${src.url}`;
    text = text ? `${header}\n\nTranscript:\n${text}` : `${header}\n\n(No transcript provided. Use only the title and channel; do not invent what the video says.)`;
  }
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

  const stream = client.beta.messages.stream(params, { signal: req.signal });
  stream.on('text', (_delta, snapshot) => req.onText(snapshot));
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
    let text = src.text?.trim() ?? '';
    if (src.kind === 'youtube') {
      const header = `YouTube video: ${src.title}${src.youtube?.author ? ` by ${src.youtube.author}` : ''}\nURL: ${src.url}`;
      text = text ? `${header}\n\nTranscript:\n${text}` : `${header}\n\n(No transcript provided. Use only the title and channel; do not invent what the video says.)`;
    }
    if (text) blocks.push(`<source title="${title}">${note}\n${text}\n</source>`);
  }
  const prompt = [
    buildSystem(req.project),
    blocks.length ? `\n<sources>\n${blocks.join('\n\n')}\n</sources>` : '',
    '\n' + buildTask(req.piece, req.mode, req.instruction, req.variations),
  ].join('\n');
  return { prompt, attachments };
}
