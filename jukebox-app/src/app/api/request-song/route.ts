import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getConfig, isOrderingOpen, matchBlockWord, DEFAULT_VENUE_ID } from '@/lib/server/data';
import { getVideoDurationSec } from '@/lib/youtube';
import type { Song } from '@/lib/types';

export async function POST(req: Request) {
  const body = await req.json();
  const vid: string = body.venueId || DEFAULT_VENUE_ID;
  const table: string = String(body.table || '').trim() || '未指定';
  const videoId: string = body.videoId;
  const title: string = body.title;
  const thumbnail: string = body.thumbnail || '';
  if (!videoId || !title) return NextResponse.json({ success: false, error: '缺少歌曲資訊' });

  const admin = createAdminClient();
  const cfg = await getConfig(vid);

  if (!isOrderingOpen(cfg)) return NextResponse.json({ success: false, error: 'CLOSED', message: '目前非開放點歌時間，請稍後再試' });
  if (matchBlockWord(title, cfg.blockWords)) return NextResponse.json({ success: false, error: 'BLOCKED', message: '這首歌不開放點播' });
  if (cfg.maxSongMin > 0) {
    const dur = await getVideoDurationSec(videoId);
    if (dur > cfg.maxSongMin * 60) {
      return NextResponse.json({ success: false, error: 'TOO_LONG', message: `歌曲超過 ${cfg.maxSongMin} 分鐘，請改點短一點的` });
    }
  }

  const { data: rows } = await admin
    .from('songs')
    .select('*')
    .eq('venue_id', vid)
    .in('status', ['waiting', 'playing']);
  const list = (rows ?? []) as Song[];
  const myWaiting = list.filter((s) => s.table_label === table).length;

  // 冷卻：點滿上限後才開始計算
  const cdMs = cfg.cooldownMin * 60 * 1000;
  if (cdMs > 0) {
    const { data: cd } = await admin
      .from('table_cooldowns')
      .select('started_at')
      .eq('venue_id', vid)
      .eq('table_label', table)
      .maybeSingle();
    if (cd?.started_at) {
      const remaining = Math.ceil((cdMs - (Date.now() - new Date(cd.started_at).getTime())) / 1000);
      if (remaining > 0) {
        return NextResponse.json({ success: false, error: 'COOLDOWN', message: '本桌已點滿，冷卻中請稍候再點', cooldownRemaining: remaining });
      }
    }
  }

  if (myWaiting >= cfg.maxPerTable) {
    return NextResponse.json({ success: false, error: 'LIMIT_REACHED', message: `本桌目前已有 ${cfg.maxPerTable} 首歌曲在排隊，請等播放完再點新歌` });
  }

  const maxPos = list.reduce((m, s) => Math.max(m, s.position), 0);
  const { data: inserted, error } = await admin
    .from('songs')
    .insert({ venue_id: vid, table_label: table, video_id: videoId, title, thumbnail, status: 'waiting', position: maxPos + 1 })
    .select('*')
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message });

  // 這次點完若達上限，開始冷卻
  if (myWaiting + 1 >= cfg.maxPerTable && cdMs > 0) {
    await admin.from('table_cooldowns').upsert({ venue_id: vid, table_label: table, started_at: new Date().toISOString() });
  }
  return NextResponse.json({ success: true, message: '已加入佇列！', song: inserted });
}
