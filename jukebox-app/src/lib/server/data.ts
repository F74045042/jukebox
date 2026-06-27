import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_CONFIG, type VenueConfig } from '@/lib/types';

export const DEFAULT_VENUE_ID = process.env.NEXT_PUBLIC_DEFAULT_VENUE_ID!;

// ---- 時間（以台北時區判斷營業時間與配額跨日）----
export function taipeiToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }); // YYYY-MM-DD
}
export function taipeiHour(): number {
  const h = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit' }),
    10,
  );
  return h % 24;
}

export async function getConfig(venueId: string): Promise<VenueConfig> {
  const admin = createAdminClient();
  const { data } = await admin.from('venue_settings').select('config').eq('venue_id', venueId).single();
  return { ...DEFAULT_CONFIG, ...((data?.config as Partial<VenueConfig>) ?? {}) };
}

export function isOrderingOpen(cfg: VenueConfig): boolean {
  if (cfg.openHour === cfg.closeHour) return true;
  const h = taipeiHour();
  if (cfg.openHour < cfg.closeHour) return h >= cfg.openHour && h < cfg.closeHour;
  return h >= cfg.openHour || h < cfg.closeHour; // 跨夜
}

export function matchBlockWord(title: string, blockWords: string): boolean {
  if (!blockWords) return false;
  const t = title.toLowerCase();
  return blockWords
    .split(/[,，\n]/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
    .some((w) => t.includes(w));
}

// ---- 每日搜尋配額 ----
export async function getQuota(venueId: string) {
  const admin = createAdminClient();
  const cfg = await getConfig(venueId);
  const { data } = await admin.from('search_quota').select('day,count').eq('venue_id', venueId).single();
  const used = data && data.day === taipeiToday() ? (data.count as number) : 0;
  return { limit: cfg.dailySearchLimit, used, remaining: Math.max(0, cfg.dailySearchLimit - used) };
}
export async function incrementQuota(venueId: string) {
  const admin = createAdminClient();
  const today = taipeiToday();
  const { data } = await admin.from('search_quota').select('day,count').eq('venue_id', venueId).single();
  const count = data && data.day === today ? (data.count as number) + 1 : 1;
  await admin.from('search_quota').upsert({ venue_id: venueId, day: today, count });
}

// ---- 驗證請求者是該店成員（player 管理動作用）----
export async function requireMember(venueId: string): Promise<{ ok: true; userId: string } | { ok: false; status: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };
  const admin = createAdminClient();
  const { data } = await admin
    .from('venue_members')
    .select('venue_id')
    .eq('venue_id', venueId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data) return { ok: false, status: 403 };
  return { ok: true, userId: user.id };
}
