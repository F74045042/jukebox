import { NextResponse } from 'next/server';
import { searchYoutube } from '@/lib/youtube';
import { getConfig, getQuota, incrementQuota, DEFAULT_VENUE_ID } from '@/lib/server/data';

export async function POST(req: Request) {
  const { query, mode, venueId } = await req.json();
  const vid: string = venueId || DEFAULT_VENUE_ID;
  if (!query) return NextResponse.json({ success: false, error: '請輸入搜尋關鍵字' });

  const quota = await getQuota(vid);
  if (quota.remaining <= 0) {
    return NextResponse.json({
      success: false,
      error: 'QUOTA_EXCEEDED',
      message: '今日搜尋次數已用完，請改用「貼上連結」的方式點歌',
      quota,
    });
  }
  const cfg = await getConfig(vid);
  const count = Math.min(20, Math.max(1, cfg.searchCount || 8));
  const { results, error } = await searchYoutube(query, mode || 'song', count, cfg.musicOnly);
  await incrementQuota(vid);
  if (error) return NextResponse.json({ success: false, error });
  return NextResponse.json({ success: true, results, quota: await getQuota(vid) });
}
