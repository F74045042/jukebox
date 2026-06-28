import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { searchYoutube } from '@/lib/youtube';

// KTV 模式：找某首歌的 YouTube 伴唱版。先查快取（全店共用），沒有才打 YouTube 搜尋並存起來。
export async function POST(req: Request) {
  const { videoId, title } = await req.json();
  if (!videoId || !title) return NextResponse.json({ success: false, error: '缺少資訊' });

  const admin = createAdminClient();
  const { data: cached } = await admin
    .from('karaoke_cache')
    .select('karaoke_video_id')
    .eq('video_id', videoId)
    .maybeSingle();
  if (cached?.karaoke_video_id) return NextResponse.json({ success: true, videoId: cached.karaoke_video_id });

  const { results } = await searchYoutube(`${title} 卡拉OK 伴唱`, 'song', 5, false);
  const kv = results?.[0]?.videoId;
  if (!kv) return NextResponse.json({ success: false, error: 'NO_KARAOKE' });

  await admin.from('karaoke_cache').upsert({ video_id: videoId, karaoke_video_id: kv, title });
  return NextResponse.json({ success: true, videoId: kv });
}
