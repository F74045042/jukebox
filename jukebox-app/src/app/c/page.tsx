'use client';

import { useEffect, useMemo, useState } from 'react';
import { useVenue } from '@/lib/useVenue';
import type { SearchResult } from '@/lib/types';

const VENUE_ID = process.env.NEXT_PUBLIC_DEFAULT_VENUE_ID!;

export default function CustomerPage() {
  const { queue, config } = useVenue(VENUE_ID);
  const [table, setTable] = useState('未指定');
  const [mode, setMode] = useState<'song' | 'artist'>('song');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('table');
    if (t) setTable(t);
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  const playing = useMemo(() => queue.find((s) => s.status === 'playing'), [queue]);
  const waiting = useMemo(() => queue.filter((s) => s.status === 'waiting'), [queue]);
  const firstWaitingId = waiting[0]?.id;

  async function doSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const r = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), mode, venueId: VENUE_ID }),
      }).then((x) => x.json());
      if (r.success) setResults(r.results || []);
      else if (r.error === 'QUOTA_EXCEEDED') flash('今日搜尋次數已用完');
      else flash('搜尋失敗：' + (r.error || ''));
    } catch {
      flash('連線失敗，請稍後再試');
    } finally {
      setSearching(false);
    }
  }

  async function addSong(r: SearchResult) {
    flash('🎶 已加入佇列！');
    try {
      const res = await fetch('/api/request-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, venueId: VENUE_ID, videoId: r.videoId, title: r.title, thumbnail: r.thumbnail }),
      }).then((x) => x.json());
      if (!res.success) flash(res.message || '加入失敗');
    } catch {
      flash('連線失敗，請稍後再試');
    }
  }

  async function paidBump(id: string) {
    const cost = config.bumpPrice > 0 ? `$${config.bumpPrice} 元` : '免費測試中';
    if (!confirm(`付費插播：${cost}\n要把這首排到最前面（下一首就播）嗎？`)) return;
    try {
      const res = await fetch('/api/paid-bump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, table, venueId: VENUE_ID }),
      }).then((x) => x.json());
      flash(res.success ? '⚡ 已插播，馬上輪到你！' : res.message || '插播失敗');
    } catch {
      flash('連線失敗，請稍後再試');
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6 text-zinc-100">
      <header className="mb-5">
        <h1 className="text-2xl font-bold">🎵 點唱機</h1>
        <p className="text-sm text-zinc-400">掃桌上 QR，點一首你想聽的歌</p>
        <div className="mt-2 inline-block rounded-full bg-orange-500/15 px-3 py-1 text-sm text-orange-300">
          桌號 <b>{table}</b>
        </div>
      </header>

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setMode('song')}
          className={`flex-1 rounded-xl py-2 text-sm font-bold ${mode === 'song' ? 'bg-orange-500/20 text-orange-300' : 'bg-white/5 text-zinc-400'}`}
        >
          🎵 歌曲
        </button>
        <button
          onClick={() => setMode('artist')}
          className={`flex-1 rounded-xl py-2 text-sm font-bold ${mode === 'artist' ? 'bg-orange-500/20 text-orange-300' : 'bg-white/5 text-zinc-400'}`}
        >
          🎤 歌手
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
          placeholder={mode === 'artist' ? '輸入歌手名稱，找熱門歌…' : '輸入歌名或歌手…'}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-orange-400"
        />
        <button onClick={doSearch} disabled={searching} className="rounded-xl bg-orange-500 px-5 font-bold text-zinc-900 disabled:opacity-50">
          {searching ? '…' : '搜尋'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="mb-6 space-y-2">
          {results.map((r) => (
            <div key={r.videoId} className="flex items-center gap-3 rounded-xl bg-white/5 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.thumbnail} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.title}</div>
                <div className="truncate text-xs text-zinc-400">{r.channel}</div>
              </div>
              <button onClick={() => addSong(r)} className="rounded-lg bg-orange-500/20 px-3 py-2 font-bold text-orange-300">
                ＋
              </button>
            </div>
          ))}
        </div>
      )}

      {playing && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={playing.thumbnail || `https://i.ytimg.com/vi/${playing.video_id}/default.jpg`} alt="" className="h-12 w-12 rounded-lg object-cover" />
          <div className="min-w-0">
            <div className="text-xs text-orange-300">🎵 現正播放</div>
            <div className="truncate text-sm font-medium">{playing.title}</div>
          </div>
        </div>
      )}

      <h2 className="mb-2 text-sm font-bold text-zinc-300">目前排隊中</h2>
      {waiting.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">目前還沒有人點歌，當第一個吧！</p>
      ) : (
        <div className="space-y-1">
          {waiting.map((s, i) => {
            const mine = s.table_label === table;
            const canBump = config.paidBumpEnabled && mine && s.id !== firstWaitingId;
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 font-mono text-xs text-zinc-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">{s.title}</span>
                <span className="text-xs text-zinc-500">{s.table_label}桌</span>
                {canBump && (
                  <button onClick={() => paidBump(s.id)} className="shrink-0 rounded-lg border border-orange-500/40 bg-orange-500/15 px-2 py-1 text-xs font-bold text-orange-300">
                    ⚡ 插播
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-zinc-800 px-4 py-2 text-sm shadow-lg">{toast}</div>
      )}
    </main>
  );
}
