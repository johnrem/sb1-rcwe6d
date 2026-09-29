export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s.startsWith('http') ? s : `https://${s}`);
    const host = url.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return url.pathname.slice(1, 12) || null;
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = url.searchParams.get('v');
      if (v) return v.slice(0, 11);
      const m = url.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    return null;
  }
  return null;
}

export interface YouTubeMeta {
  title: string;
  author?: string;
  thumbnail: string;
}

/** Title/channel via oEmbed (no API key needed). Falls back to noembed, then to bare defaults. */
export async function fetchYouTubeMeta(videoId: string): Promise<YouTubeMeta> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const fallback = { title: `YouTube video ${videoId}`, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` };
  for (const endpoint of [
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`,
    `https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`,
  ]) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const j = await res.json();
      if (!j.title) continue;
      return { title: j.title, author: j.author_name, thumbnail: j.thumbnail_url || fallback.thumbnail };
    } catch {
      // CORS or network failure: try the next endpoint.
    }
  }
  return fallback;
}

const TS = /^(\d{1,2}:\d{2}(?::\d{2})?)$/;
const TS_PREFIX = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/;
const SPOKEN_TS = /^\d+ (hours?|minutes?|seconds?)(, \d+ (minutes?|seconds?))*$/;

/**
 * Cleans a transcript pasted from YouTube's "Show transcript" panel.
 * Timestamps are kept as compact "[m:ss]" markers so shot lists can cite exact moments.
 */
export function cleanTranscript(raw: string): string {
  const out: string[] = [];
  let pending: string | null = null;
  for (const line of raw.split('\n').map((l) => l.trim())) {
    if (!line || SPOKEN_TS.test(line)) continue;
    const ts = line.match(TS);
    if (ts) {
      pending = ts[1];
      continue;
    }
    const inline = line.match(TS_PREFIX);
    if (inline) {
      out.push(`[${inline[1]}] ${inline[2]}`);
      pending = null;
    } else if (pending) {
      out.push(`[${pending}] ${line}`);
      pending = null;
    } else if (out.length) {
      out[out.length - 1] += ` ${line}`;
    } else {
      out.push(line);
    }
  }
  return out.join('\n').trim();
}

export interface ChannelVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt?: string;
  views?: number;
  duration?: string;
  thumbnail: string;
}

export interface ChannelResult {
  channelId: string;
  title: string;
  videos: ChannelVideo[];
  via: 'api' | 'feed';
}

const YT_API = 'https://www.googleapis.com/youtube/v3';

async function ytApi(path: string, params: Record<string, string>, key: string) {
  const url = `${YT_API}/${path}?${new URLSearchParams({ ...params, key })}`;
  const res = await fetch(url);
  const j = await res.json();
  if (!res.ok) throw new Error(`YouTube API: ${j.error?.message ?? res.status}`);
  return j;
}

/** Accepts a channel URL, @handle or UC… channel ID. */
export function parseChannelInput(input: string): { id?: string; handle?: string; user?: string; query?: string } {
  const s = input.trim();
  const id = s.match(/(UC[\w-]{22})/);
  if (id) return { id: id[1] };
  const handle = s.match(/@([\w.-]+)/);
  if (handle) return { handle: handle[1] };
  const user = s.match(/youtube\.com\/user\/([\w.-]+)/);
  if (user) return { user: user[1] };
  const custom = s.match(/youtube\.com\/c\/([\w.-]+)/);
  return { query: custom ? custom[1] : s };
}

function bestThumb(t: Record<string, { url: string }> | undefined, id: string) {
  return t?.high?.url || t?.medium?.url || t?.default?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Full upload history with stats via the YouTube Data API (needs a free API key). */
async function channelViaApi(input: string, key: string, max: number): Promise<ChannelResult> {
  const p = parseChannelInput(input);
  const params: Record<string, string> = { part: 'snippet,contentDetails' };
  if (p.id) params.id = p.id;
  else if (p.handle) params.forHandle = p.handle;
  else if (p.user) params.forUsername = p.user;
  else {
    const search = await ytApi('search', { part: 'snippet', type: 'channel', maxResults: '1', q: p.query! }, key);
    const found = search.items?.[0]?.snippet?.channelId;
    if (!found) throw new Error('No channel found for that name.');
    params.id = found;
  }
  const ch = (await ytApi('channels', params, key)).items?.[0];
  if (!ch) throw new Error('Channel not found. Try the full channel URL or @handle.');
  const uploads = ch.contentDetails.relatedPlaylists.uploads;

  const ids: string[] = [];
  let pageToken = '';
  while (ids.length < max) {
    const page = await ytApi('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: '50', ...(pageToken ? { pageToken } : {}) }, key);
    ids.push(...page.items.map((i: { contentDetails: { videoId: string } }) => i.contentDetails.videoId));
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }

  const videos: ChannelVideo[] = [];
  for (let i = 0; i < Math.min(ids.length, max); i += 50) {
    const batch = await ytApi('videos', { part: 'snippet,statistics,contentDetails', id: ids.slice(i, i + 50).join(',') }, key);
    for (const v of batch.items) {
      videos.push({
        videoId: v.id,
        title: v.snippet.title,
        description: v.snippet.description ?? '',
        publishedAt: v.snippet.publishedAt,
        views: v.statistics?.viewCount ? Number(v.statistics.viewCount) : undefined,
        duration: v.contentDetails?.duration,
        thumbnail: bestThumb(v.snippet.thumbnails, v.id),
      });
    }
  }
  return { channelId: ch.id, title: ch.snippet.title, videos, via: 'api' };
}

/** Via the site's /api/yt-channel function: full history if the site has a YOUTUBE_API_KEY, else the latest ~15 uploads. */
async function channelViaFeed(input: string): Promise<ChannelResult> {
  let res: Response;
  try {
    res = await fetch(`/api/yt-channel?input=${encodeURIComponent(input)}`);
  } catch {
    throw new Error('Could not reach the channel reader. It runs on the deployed site; locally, add a YouTube API key in Settings.');
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json')) throw new Error('The channel reader only runs on the deployed site. Locally, add a YouTube API key in Settings.');
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? `Channel reader failed (${res.status}).`);
  return { ...j, via: j.source === 'api' ? 'api' : 'feed' };
}

export function fetchChannel(input: string, youtubeApiKey?: string, max = 200): Promise<ChannelResult> {
  return youtubeApiKey ? channelViaApi(input, youtubeApiKey, max) : channelViaFeed(input);
}

/** "PT1H2M10S" → "1:02:10" */
export function formatDuration(iso?: string) {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const [h, mi, s] = [m[1], m[2], m[3]].map((x) => Number(x ?? 0));
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(mi).padStart(2, '0')}:${ss}` : `${mi}:${ss}`;
}

export function formatViews(n?: number) {
  if (n == null) return '';
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K views`;
  return `${n} views`;
}
