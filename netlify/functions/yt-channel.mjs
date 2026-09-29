// Reads a YouTube channel's public RSS feed (latest ~15 uploads with view counts).
// Runs server-side on Netlify because browsers can't fetch YouTube pages directly (CORS).
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

export default async (req) => {
  const input = new URL(req.url).searchParams.get('input');
  if (!input || input.length > 300) return json({ error: 'Pass ?input= with a channel URL, @handle or channel ID.' }, 400);
  try {
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
    return json({ channelId, title: tag(head, 'title'), videos });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
};

export const config = { path: '/api/yt-channel' };
