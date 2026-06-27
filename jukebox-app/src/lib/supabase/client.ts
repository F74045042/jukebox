'use client';

// 瀏覽器端 Supabase client（anon key）。用於讀取佇列/設定與 realtime 訂閱。
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
