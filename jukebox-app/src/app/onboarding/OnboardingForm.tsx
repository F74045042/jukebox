'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/venue/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then((x) => x.json());
      if (r.success) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setErr('建立失敗：' + (r.error || ''));
        setBusy(false);
      }
    } catch {
      setErr('連線失敗，請稍後再試');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 rounded-2xl p-6">
        <h1 className="text-xl font-bold">🏪 建立你的店</h1>
        <p className="text-sm text-[var(--muted)]">取一個店名，等等會用來產生客人點歌的 QR Code。</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="店名（例如：阿明小吃）"
          className="input-ember w-full rounded-xl px-4 py-3 text-sm" />
        {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
        <button type="submit" disabled={busy} className="btn-ember w-full rounded-xl py-3 disabled:opacity-50">
          {busy ? '建立中…' : '建立店家'}
        </button>
      </form>
    </main>
  );
}
