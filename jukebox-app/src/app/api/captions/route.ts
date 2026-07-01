import { NextResponse } from 'next/server';

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string };
}

// 從 YouTube 影片抓「內建字幕(CC)」的文字＋時間軸，轉成和 LRCLIB 一樣的 {t,text} 行。
// 只取人工字幕（跳過 asr 自動生成，音樂的自動字幕通常不是歌詞）。
export async function POST(req: Request) {
  const { videoId } = await req.json();
  if (!videoId) return NextResponse.json({ success: false, error: '缺少 videoId' });
  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=zh-TW`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        Cookie: 'CONSENT=YES+cb',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!page.ok) return NextResponse.json({ success: false, error: 'FETCH_FAIL' });
    const html = await page.text();

    const key = '"captionTracks":';
    const at = html.indexOf(key);
    if (at < 0) return NextResponse.json({ success: false, error: 'NO_CC' });
    const start = html.indexOf('[', at);
    let depth = 0;
    let end = -1;
    for (let j = start; j < html.length; j++) {
      if (html[j] === '[') depth++;
      else if (html[j] === ']') {
        depth--;
        if (depth === 0) { end = j + 1; break; }
      }
    }
    if (end < 0) return NextResponse.json({ success: false, error: 'NO_CC' });
    const tracks = JSON.parse(html.slice(start, end)) as CaptionTrack[];
    const track = tracks.find((t) => t.kind !== 'asr') || null; // 只要人工字幕
    if (!track?.baseUrl) return NextResponse.json({ success: false, error: 'NO_CC' });

    const capRes = await fetch(track.baseUrl + '&fmt=json3', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!capRes.ok) return NextResponse.json({ success: false, error: 'CC_FETCH_FAIL' });
    const data = (await capRes.json()) as { events?: { tStartMs?: number; segs?: { utf8?: string }[] }[] };
    const lines: { t: number; text: string }[] = [];
    for (const e of data.events || []) {
      if (!e.segs) continue;
      const text = e.segs.map((s) => s.utf8 || '').join('').replace(/\n/g, ' ').trim();
      if (!text) continue;
      lines.push({ t: (e.tStartMs || 0) / 1000, text });
    }
    if (lines.length === 0) return NextResponse.json({ success: false, error: 'EMPTY' });
    return NextResponse.json({ success: true, lines, name: track.name?.simpleText || track.languageCode || 'CC' });
  } catch {
    return NextResponse.json({ success: false, error: 'ERROR' });
  }
}
