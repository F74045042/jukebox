import { NextResponse } from 'next/server';

// 從歌名清掉雜訊（【】()（）、Official/MV/feat… 等），提高 LRCLIB 命中率
function cleanTitle(title: string): string {
  return title
    .replace(/【.*?】|（.*?）|\(.*?\)|\[.*?\]/g, ' ')
    .replace(/official\s*(music)?\s*(video|mv|audio)?|lyric(s)?\s*video|m\/?v|hd|4k|live|feat\.?.*$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface LrclibHit {
  trackName?: string;
  artistName?: string;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

// KTV 歌詞：用 LRCLIB（免費、免金鑰）搜尋同步歌詞
export async function POST(req: Request) {
  const { title } = await req.json();
  if (!title) return NextResponse.json({ success: false, error: '缺少歌名' });
  const q = cleanTitle(String(title)) || String(title);
  try {
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'jukebox-app (https://github.com/F74045042/jukebox)' },
    });
    if (!res.ok) return NextResponse.json({ success: false, error: 'NOT_FOUND' });
    const arr = (await res.json()) as LrclibHit[];
    if (!Array.isArray(arr) || arr.length === 0) return NextResponse.json({ success: false, error: 'NOT_FOUND' });
    const hit = arr.find((x) => x.syncedLyrics) || arr[0];
    return NextResponse.json({
      success: true,
      synced: hit.syncedLyrics || null,
      plain: hit.plainLyrics || null,
      track: hit.trackName,
      artist: hit.artistName,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'NOT_FOUND' });
  }
}
