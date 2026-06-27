import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getConfig, DEFAULT_VENUE_ID } from '@/lib/server/data';

export async function POST(req: Request) {
  const body = await req.json();
  const vid: string = body.venueId || DEFAULT_VENUE_ID;
  const id: string = body.id;
  const table: string = String(body.table || '').trim() || '未指定';
  if (!id) return NextResponse.json({ success: false, error: '缺少歌曲' });

  const cfg = await getConfig(vid);
  const needed = cfg.skipVotesNeeded;
  if (needed <= 0) return NextResponse.json({ success: false, error: 'DISABLED' });

  const admin = createAdminClient();
  // 每桌每首一票（song_id + table_label 為主鍵，重複投票會被忽略）
  await admin.from('skip_votes').upsert({ venue_id: vid, song_id: id, table_label: table }, { onConflict: 'song_id,table_label', ignoreDuplicates: true });

  const { count } = await admin.from('skip_votes').select('*', { count: 'exact', head: true }).eq('song_id', id);
  const votes = count ?? 0;
  if (votes >= needed) {
    await admin.from('songs').update({ status: 'played', played_at: new Date().toISOString() }).eq('id', id).eq('venue_id', vid);
    return NextResponse.json({ success: true, skipped: true, votes, needed });
  }
  return NextResponse.json({ success: true, skipped: false, votes, needed });
}
