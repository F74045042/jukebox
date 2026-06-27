import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 伺服器端 Supabase client（綁定登入 cookie）。用於 player 驗證登入身分。
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 在 Server Component 中呼叫 set 會被忽略；有 middleware 處理刷新即可。
          }
        },
      },
    },
  );
}
