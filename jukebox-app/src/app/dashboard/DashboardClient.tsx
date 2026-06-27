'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/client';

const DEFAULT_TABLES = ['A', 'B', 'C', 'D'].flatMap((r) => [1, 2, 3, 4, 5].map((c) => `${r}${c}`)).join(' ');

export default function DashboardClient({ venue, email }: { venue: { id: string; name: string }; email: string }) {
  const router = useRouter();
  const [origin, setOrigin] = useState('');
  const [tablesText, setTablesText] = useState(DEFAULT_TABLES);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    const saved = localStorage.getItem(`jukebox_tables_${venue.id}`);
    if (saved) setTablesText(saved);
  }, [venue.id]);

  const tables = useMemo(() => tablesText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean), [tablesText]);

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        tables.map(async (tb) => {
          const url = `${origin}/v/${venue.id}?table=${encodeURIComponent(tb)}`;
          const data = await QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: '#0e0b09', light: '#ffffff' } });
          return [tb, data] as const;
        }),
      );
      if (!cancelled) setQrs(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [origin, tables, venue.id]);

  function saveTables() {
    localStorage.setItem(`jukebox_tables_${venue.id}`, tablesText);
  }
  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  }
  async function logout() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const playerUrl = `${origin}/player`;
  const customerBase = `${origin}/v/${venue.id}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ember)]" />
            <h1 className="text-xl font-bold">{venue.name}</h1>
          </div>
          <p className="mt-1 text-xs text-[var(--faint)]">{email}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <a href="/player" className="card rounded-lg px-3 py-1.5">▶ 開啟播放器</a>
          <button onClick={logout} className="card rounded-lg px-3 py-1.5">登出</button>
        </div>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 print:hidden">
        <div className="card rounded-xl p-4">
          <div className="text-xs text-[var(--faint)]">店家播放器（平板登入用）</div>
          <div className="mono mt-1 truncate text-sm">{playerUrl}</div>
          <button onClick={() => copy(playerUrl, 'player')} className="btn-ember mt-2 rounded-lg px-3 py-1.5 text-xs">
            {copied === 'player' ? '已複製 ✓' : '複製'}
          </button>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-[var(--faint)]">客人點歌（各桌網址 = 此網址 + ?table=桌號）</div>
          <div className="mono mt-1 truncate text-sm">{customerBase}</div>
          <button onClick={() => copy(customerBase, 'cust')} className="btn-ember mt-2 rounded-lg px-3 py-1.5 text-xs">
            {copied === 'cust' ? '已複製 ✓' : '複製'}
          </button>
        </div>
      </section>

      <section className="mb-4 card rounded-xl p-4 print:hidden">
        <label className="text-sm font-bold">桌號清單（空白或逗號分隔）</label>
        <textarea
          value={tablesText}
          onChange={(e) => setTablesText(e.target.value)}
          onBlur={saveTables}
          rows={2}
          className="input-ember mt-2 w-full rounded-lg px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center gap-3">
          <button onClick={() => window.print()} className="btn-ember rounded-lg px-4 py-2 text-sm">🖨 列印 / 存成 PDF</button>
          <span className="text-xs text-[var(--faint)]">共 {tables.length} 桌。點每張 QR 下方可單獨下載。</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {tables.map((tb) => (
          <div key={tb} className="card flex flex-col items-center rounded-xl p-3">
            <div className="mb-2 text-sm font-bold">{tb}</div>
            {qrs[tb] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrs[tb]} alt={`QR ${tb}`} className="w-full rounded-lg bg-white" />
            ) : (
              <div className="aspect-square w-full animate-pulse rounded-lg bg-white/10" />
            )}
            {qrs[tb] && (
              <a href={qrs[tb]} download={`${tb}.png`} className="mt-2 text-xs text-[#ffb088] print:hidden">下載 PNG</a>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
