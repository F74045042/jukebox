import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getConfig, DEFAULT_VENUE_ID } from '@/lib/server/data';
import type { Song } from '@/lib/types';

export async function POST(req: Request) {
  const body = await req.json();
  const vid: string = body.venueId || DEFAULT_VENUE_ID;
  const id: string = body.id;
  const table: string = String(body.table || '').trim();
  if (!id) return NextResponse.json({ success: false, error: '缺少歌曲' });

  const cfg = await getConfig(vid);
  if (!cfg.paidBumpEnabled) return NextResponse.json({ success: false, error: 'DISABLED', message: '目前未開放插播' });

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('songs')
    .select('*')
    .eq('venue_id', vid)
    .in('status', ['waiting', 'playing']);
  const list = (rows ?? []) as Song[];
  const target = list.find((s) => s.id === id);
  if (!target) return NextResponse.json({ success: false, error: 'NOT_FOUND', message: '找不到這首歌，可能已經播過了' });
  if (target.status === 'playing') return NextResponse.json({ success: false, error: 'PLAYING', message: '這首正在播放中' });
  if (table && target.table_label !== table) return NextResponse.json({ success: false, error: 'NOT_OWNER', message: '只能插播自己點的歌' });

  const minPos = list.reduce((m, s) => Math.min(m, s.position), Infinity);
  await admin.from('songs').update({ position: (minPos === Infinity ? 1 : minPos) - 1 }).eq('id', id);
  return NextResponse.json({ success: true, message: '已插播，馬上輪到你！', price: cfg.bumpPrice });
}
