'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) {
      setErr('登入失敗：' + error.message);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-zinc-100">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-bold">🎛️ 播放器登入</h1>
        <p className="text-sm text-zinc-400">給店家平板用，客人點歌頁不需登入。</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-400"
        />
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="密碼"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-400"
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-orange-500 py-3 font-bold text-zinc-900 disabled:opacity-50">
          {busy ? '登入中…' : '登入'}
        </button>
        <p className="text-center text-sm text-[var(--muted)]">還沒有店家帳號？<Link href="/signup" className="text-[#ffb088]">註冊開店</Link></p>
      </form>
    </main>
  );
}
