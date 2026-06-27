import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireMember, getConfig, DEFAULT_VENUE_ID } from '@/lib/server/data';
import type { Song, VenueConfig } from '@/lib/types';

// 店家管理動作（需登入且為該店成員）
export async function POST(req: Request) {
  const body = await req.json();
  const vid: string = body.venueId || DEFAULT_VENUE_ID;
  const action: string = body.action;

  const auth = await requireMember(vid);
  if (!auth.ok) return NextResponse.json({ success: false, error: 'AUTH' }, { status: auth.status });

  const admin = createAdminClient();

  switch (action) {
    case 'markPlaying': {
      await admin.from('songs').update({ status: 'playing' }).eq('id', body.id).eq('venue_id', vid);
      return NextResponse.json({ success: true });
    }
    case 'markPlayed':
    case 'skipSong': {
      await admin
        .from('songs')
        .update({ status: 'played', played_at: new Date().toISOString() })
        .eq('id', body.id)
        .eq('venue_id', vid);
      return NextResponse.json({ success: true });
    }
    case 'deleteSong': {
      await admin.from('songs').delete().eq('id', body.id).eq('venue_id', vid);
      return NextResponse.json({ success: true });
    }
    case 'bumpSong': {
      const { data: rows } = await admin
        .from('songs')
        .select('*')
        .eq('venue_id', vid)
        .in('status', ['waiting', 'playing']);
      const list = (rows ?? []) as Song[];
      const minPos = list.reduce((m, s) => Math.min(m, s.position), Infinity);
      await admin.from('songs').update({ position: (minPos === Infinity ? 1 : minPos) - 1 }).eq('id', body.id).eq('venue_id', vid);
      return NextResponse.json({ success: true });
    }
    case 'clearQueue': {
      await admin.from('songs').delete().eq('venue_id', vid).in('status', ['waiting', 'playing']);
      return NextResponse.json({ success: true });
    }
    case 'clearHistory': {
      await admin.from('songs').delete().eq('venue_id', vid).eq('status', 'played');
      return NextResponse.json({ success: true });
    }
    case 'hideHistory': {
      // 從歷史回放清單移除（隱藏，不刪除原始紀錄/統計）
      await admin.from('songs').update({ hidden: true }).eq('id', body.id).eq('venue_id', vid);
      return NextResponse.json({ success: true });
    }
    case 'reorderHistory': {
      // body.ids：新的歷史排序（videoId 不可靠，用 song id）。逐列寫入 replay_position。
      const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
      await Promise.all(
        ids.map((sid, i) => admin.from('songs').update({ replay_position: i }).eq('id', sid).eq('venue_id', vid)),
      );
      return NextResponse.json({ success: true });
    }
    case 'saveSettings': {
      const current = await getConfig(vid);
      const next: VenueConfig = { ...current, ...(body.config as Partial<VenueConfig>) };
      await admin.from('venue_settings').upsert({ venue_id: vid, config: next, updated_at: new Date().toISOString() });
      return NextResponse.json({ success: true, config: next });
    }
    default:
      return NextResponse.json({ success: false, error: '未知的 action' }, { status: 400 });
  }
}
