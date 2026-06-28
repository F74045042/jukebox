export interface LyricLine {
  t: number; // 秒
  text: string;
}

// 解析 LRC 格式歌詞（每行可能有多個時間標籤）成依時間排序的行陣列
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split('\n')) {
    const text = raw.replace(/\[[0-9:.]+\]/g, '').trim();
    const stamps = raw.match(/\[(\d+):(\d+)(?:\.(\d+))?\]/g);
    if (!stamps) continue;
    for (const s of stamps) {
      const m = s.match(/\[(\d+):(\d+)(?:\.(\d+))?\]/);
      if (!m) continue;
      const t = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0);
      out.push({ t, text });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
