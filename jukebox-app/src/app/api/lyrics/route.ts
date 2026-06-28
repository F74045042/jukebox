import { NextResponse } from 'next/server';

// 從歌名清掉雜訊（【】()（）、Official/MV/feat… 等），提高命中率
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

// KTV 歌詞：LRCLIB（免費、免金鑰）。西洋歌覆蓋佳；華語多半找不到（會回 NOT_FOUND，前端提示改用 MV）。
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

    // 依「歌名/歌手與查詢字詞吻合度」排序；同步歌詞加分但不壓過相關度
    const qWords = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    const ranked = arr
      .map((h) => {
        const hay = `${h.artistName || ''} ${h.trackName || ''}`.toLowerCase();
        const matched = qWords.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
        return { h, matched, s: matched + (h.syncedLyrics ? 0.5 : 0) };
      })
      .sort((a, b) => b.s - a.s);
    const best = ranked[0];
    // 至少一個字詞要對上，否則寧可回「找不到」也不亂塞
    if (!best || best.matched === 0) return NextResponse.json({ success: false, error: 'NOT_FOUND' });

    return NextResponse.json({
      success: true,
      synced: best.h.syncedLyrics || null,
      plain: best.h.plainLyrics || null,
      track: best.h.trackName,
      artist: best.h.artistName,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'NOT_FOUND' });
  }
}
