// Lists a YouTube channel's uploads for Content Studio's Auto section.
// With a YOUTUBE_API_KEY environment variable set in Netlify (Site configuration → Environment variables),
// it uses the YouTube Data API: full upload history with views and durations, and the key never reaches browsers.
// Without one it falls back to the public RSS feed (latest ~15 uploads with view counts).
// Runs server-side because browsers can't fetch YouTube pages directly (CORS).
// GET /api/yt-channel?input=<channel URL | @handle | UC… id>

const HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; ContentStudio/1.0)',
  'accept-language': 'en-US,en;q=0.9',
  cookie: 'CONSENT=YES+1; SOCS=CAI',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': status === 200 ? 'public, max-age=600' : 'no-store' },
  });

const decode = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '').trim();

async function resolveChannelId(input) {
  const s = input.trim();
  const direct = s.match(/(UC[\w-]{22})/);
  if (direct) return direct[1];
  let url;
  const handle = s.match(/@([\w.-]+)/);
  if (handle) url = `https://www.youtube.com/@${handle[1]}`;
  else if (/^https?:\/\/(www\.|m\.)?youtube\.com\//.test(s)) url = s;
  else url = `https://www.youtube.com/@${s.replace(/\s+/g, '')}`;
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`Couldn't open that channel page (${res.status}). Try the channel's @handle or its UC… ID.`);
  const html = await res.text();
  const id =
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1] ||
    html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] ||
    html.match(/"channelId":"(UC[\w-]{22})"/)?.[1];
  if (!id) throw new Error("Couldn't find a channel ID on that page. Try the channel's UC… ID (in the channel's About → Share).");
  return id;
}

const API = 'https://www.googleapis.com/youtube/v3';
const MAX_VIDEOS = 300;

async function yt(path, params, key) {
  const res = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`);
  const j = await res.json();
  if (!res.ok) throw new Error(`YouTube API: ${j.error?.message ?? res.status}`);
  return j;
}

async function viaApi(input, key) {
  const s = input.trim();
  const params = { part: 'snippet,contentDetails' };
  const id = s.match(/(UC[\w-]{22})/)?.[1];
  const handle = s.match(/@([\w.-]+)/)?.[1];
  if (id) params.id = id;
  else if (handle) params.forHandle = handle;
  else params.id = await resolveChannelId(s);
  const ch = (await yt('channels', params, key)).items?.[0];
  if (!ch) throw new Error('Channel not found. Try the full channel URL or @handle.');

  const ids = [];
  let pageToken = '';
  while (ids.length < MAX_VIDEOS) {
    const page = await yt('playlistItems', { part: 'contentDetails', playlistId: ch.contentDetails.relatedPlaylists.uploads, maxResults: '50', ...(pageToken && { pageToken }) }, key);
    ids.push(...page.items.map((i) => i.contentDetails.videoId));
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }

  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = await yt('videos', { part: 'snippet,statistics,contentDetails', id: ids.slice(i, i + 50).join(',') }, key);
    for (const v of batch.items) {
      const t = v.snippet.thumbnails ?? {};
      videos.push({
        videoId: v.id,
        title: v.snippet.title,
        description: v.snippet.description ?? '',
        publishedAt: v.snippet.publishedAt,
        views: v.statistics?.viewCount ? Number(v.statistics.viewCount) : undefined,
        duration: v.contentDetails?.duration,
        thumbnail: t.high?.url || t.medium?.url || t.default?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      });
    }
  }
  return { channelId: ch.id, title: ch.snippet.title, videos, source: 'api' };
}

export default async (req) => {
  const input = new URL(req.url).searchParams.get('input');
  if (!input || input.length > 300) return json({ error: 'Pass ?input= with a channel URL, @handle or channel ID.' }, 400);
  try {
    const key = process.env.YOUTUBE_API_KEY;
    if (key) return json(await viaApi(input, key));
    const channelId = await resolveChannelId(input);
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { headers: HEADERS });
    if (!res.ok) return json({ error: `YouTube feed returned ${res.status}.` }, 502);
    const xml = await res.text();
    const head = xml.split('<entry>')[0];
    const videos = xml
      .split('<entry>')
      .slice(1)
      .map((e) => {
        const videoId = tag(e, 'yt:videoId');
        const views = e.match(/<media:statistics views="(\d+)"/)?.[1];
        return {
          videoId,
          title: tag(e, 'title'),
          description: tag(e, 'media:description'),
          publishedAt: tag(e, 'published'),
          views: views ? Number(views) : undefined,
          thumbnail: e.match(/<media:thumbnail url="([^"]+)"/)?.[1] ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        };
      })
      .filter((v) => v.videoId);
    return json({ channelId, title: tag(head, 'title'), videos, source: 'feed' });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
};

export const config = { path: '/api/yt-channel' };
