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

/** Cleans a transcript pasted from YouTube's "Show transcript" panel (drops timestamps/line noise). */
export function cleanTranscript(raw: string): string {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(l) && !/^\d+ (seconds?|minutes?)(, \d+ seconds?)?$/.test(l))
    .map((l) => l.replace(/^\d{1,2}:\d{2}(:\d{2})?\s*/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
