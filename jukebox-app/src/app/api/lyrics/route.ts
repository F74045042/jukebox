import { NextResponse } from 'next/server';

// 把這個 function 部署到亞洲區（網易雲會擋美國機房 IP）。Hobby 方案可能會忽略此設定。
export const preferredRegion = ['hkg1', 'sin1', 'icn1'];

// 從歌名清掉雜訊（【】()（）、Official/MV/feat… 等），提高命中率
function cleanTitle(title: string): string {
  return title
    .replace(/【.*?】|（.*?）|\(.*?\)|\[.*?\]/g, ' ')
    .replace(/official\s*(music)?\s*(video|mv|audio)?|lyric(s)?\s*video|m\/?v|hd|4k|live|feat\.?.*$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasCJK(s: string): boolean {
  return /[一-鿿぀-ヿ가-힯]/.test(s);
}

interface LyricResult {
  success: true;
  synced: string | null;
  plain: string | null;
  track?: string;
  artist?: string;
}

function relevant(q: string, hay: string): number {
  const qWords = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  return qWords.reduce((n, w) => n + (hay.toLowerCase().includes(w) ? 1 : 0), 0);
}

// ---- LRCLIB（西洋為主，免金鑰）----
interface LrclibHit {
  trackName?: string;
  artistName?: string;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}
async function tryLrclib(q: string): Promise<LyricResult | null> {
  try {
    const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'jukebox-app (https://github.com/F74045042/jukebox)' },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as LrclibHit[];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const ranked = arr
      .map((h) => {
        const matched = relevant(q, `${h.artistName || ''} ${h.trackName || ''}`);
        return { h, matched, s: matched + (h.syncedLyrics ? 0.5 : 0) };
      })
      .sort((a, b) => b.s - a.s);
    const best = ranked[0];
    if (!best || best.matched === 0) return null;
    return { success: true, synced: best.h.syncedLyrics || null, plain: best.h.plainLyrics || null, track: best.h.trackName, artist: best.h.artistName };
  } catch {
    return null;
  }
}

// ---- 網易雲音樂（華語覆蓋佳，非官方端點）----
interface NeteaseSong {
  id: number;
  name: string;
  artists?: { name: string }[];
}
async function tryNetease(q: string): Promise<LyricResult | null> {
  try {
    const sres = await fetch(`https://music.163.com/api/search/get?s=${encodeURIComponent(q)}&type=1&limit=5`, {
      headers: { Referer: 'https://music.163.com', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!sres.ok) return null;
    const sdata = (await sres.json()) as { result?: { songs?: NeteaseSong[] } };
    const songs = sdata?.result?.songs;
    if (!Array.isArray(songs) || songs.length === 0) return null;
    const ranked = songs
      .map((s) => {
        const artist = (s.artists || []).map((a) => a.name).join(' ');
        return { s, artist, matched: relevant(q, `${artist} ${s.name}`) };
      })
      .sort((a, b) => b.matched - a.matched);
    const best = ranked[0];
    if (!best || best.matched === 0) return null;

    const lres = await fetch(`https://music.163.com/api/song/lyric?id=${best.s.id}&lv=1&kv=1&tv=-1`, {
      headers: { Referer: 'https://music.163.com', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000),
    });
    if (!lres.ok) return null;
    const ldata = (await lres.json()) as { lrc?: { lyric?: string } };
    const lrc = ldata?.lrc?.lyric;
    if (!lrc) return null;
    const synced = /\[\d+:\d+/.test(lrc);
    return { success: true, synced: synced ? lrc : null, plain: synced ? null : lrc, track: best.s.name, artist: best.artist };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { title } = await req.json();
  if (!title) return NextResponse.json({ success: false, error: '缺少歌名' });
  const q = cleanTitle(String(title)) || String(title);

  // 中文歌先試網易雲、英文先試 LRCLIB；彼此後援
  const order = hasCJK(q) ? [tryNetease, tryLrclib] : [tryLrclib, tryNetease];
  for (const fn of order) {
    const r = await fn(q);
    if (r) return NextResponse.json(r);
  }
  return NextResponse.json({ success: false, error: 'NOT_FOUND' });
}
