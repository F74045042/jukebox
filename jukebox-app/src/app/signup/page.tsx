'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password: pw });
    setBusy(false);
    if (error) {
      setMsg('註冊失敗：' + error.message);
    } else if (data.session) {
      router.push('/onboarding');
      router.refresh();
    } else {
      setMsg('註冊成功！請到信箱收確認信，確認後再回來登入。');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 rounded-2xl p-6">
        <h1 className="text-xl font-bold">🎵 開店註冊</h1>
        <p className="text-sm text-[var(--muted)]">建立你的點唱機帳號（給店家用）。</p>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email"
          className="input-ember w-full rounded-xl px-4 py-3 text-sm" />
        <input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="密碼（至少 6 碼）"
          className="input-ember w-full rounded-xl px-4 py-3 text-sm" />
        {msg && <p className="text-sm text-[#ffb088]">{msg}</p>}
        <button type="submit" disabled={busy} className="btn-ember w-full rounded-xl py-3 disabled:opacity-50">
          {busy ? '處理中…' : '註冊'}
        </button>
        <p className="text-center text-sm text-[var(--muted)]">已有帳號？<Link href="/login" className="text-[#ffb088]">登入</Link></p>
      </form>
    </main>
  );
}
