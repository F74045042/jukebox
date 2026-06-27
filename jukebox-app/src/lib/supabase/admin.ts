import 'server-only';
import { createClient } from '@supabase/supabase-js';

// service-role client：略過 RLS，只能在伺服器端（Route Handlers）使用。
// 所有「有商業邏輯的寫入」（點歌、插播、跳過、管理）都透過它執行，把規則集中在後端。
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
