import 'server-only';
import type { SearchResult } from '@/lib/types';

export function decodeHtmlEntities(str: string): string {
  if (!str) return str;
  return String(str)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

interface YtSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { default?: { url?: string } };
  };
}
interface YtSearchResponse {
  items?: YtSearchItem[];
  error?: { message?: string };
}

async function ytSearchRaw(query: string, count: number, musicOnly: boolean, order: string): Promise<YtSearchResponse> {
  const cat = musicOnly ? '&videoCategoryId=10&regionCode=TW' : '';
  const ord = order ? `&order=${order}` : '';
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video${cat}${ord}` +
    `&maxResults=${count}&q=${encodeURIComponent(query)}&key=${process.env.YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  return (await res.json()) as YtSearchResponse;
}

export async function searchYoutube(
  query: string,
  mode: string,
  count: number,
  musicOnly: boolean,
): Promise<{ results?: SearchResult[]; error?: string }> {
  const order = mode === 'artist' ? 'viewCount' : 'relevance';
  let data = await ytSearchRaw(query, count, musicOnly, order);
  if (musicOnly && data.items && data.items.length === 0) {
    data = await ytSearchRaw(query, count, false, order);
  }
  if (!data.items) return { error: data.error?.message || '搜尋失敗' };
  const results: SearchResult[] = data.items
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      videoId: it.id!.videoId!,
      title: decodeHtmlEntities(it.snippet?.title ?? ''),
      thumbnail: it.snippet?.thumbnails?.default?.url ?? '',
      channel: decodeHtmlEntities(it.snippet?.channelTitle ?? ''),
    }));
  return { results };
}

interface YtVideosResponse {
  items?: { contentDetails?: { duration?: string } }[];
}
function parseDuration(iso: string): number {
  const m = String(iso).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return parseInt(m[1] || '0', 10) * 3600 + parseInt(m[2] || '0', 10) * 60 + parseInt(m[3] || '0', 10);
}
export async function getVideoDurationSec(videoId: string): Promise<number> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(videoId)}&key=${process.env.YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as YtVideosResponse;
    const iso = data.items?.[0]?.contentDetails?.duration;
    return iso ? parseDuration(iso) : 0;
  } catch {
    return 0;
  }
}
