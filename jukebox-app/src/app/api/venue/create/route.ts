import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 建立店家並把目前登入者設為店主。已有店則直接回傳既有的。
export async function POST(req: Request) {
  const { name } = await req.json();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'AUTH' }, { status: 401 });

  const admin = createAdminClient();
  const existing = await admin.from('venue_members').select('venue_id').eq('user_id', user.id).maybeSingle();
  if (existing.data) return NextResponse.json({ success: true, venueId: existing.data.venue_id });

  const { data: venue, error } = await admin
    .from('venues')
    .insert({ name: String(name || '我的店').slice(0, 60) })
    .select('id')
    .single();
  if (error || !venue) return NextResponse.json({ success: false, error: error?.message || '建立失敗' }, { status: 500 });

  await admin.from('venue_members').insert({ venue_id: venue.id, user_id: user.id, role: 'owner' });
  return NextResponse.json({ success: true, venueId: venue.id });
}
