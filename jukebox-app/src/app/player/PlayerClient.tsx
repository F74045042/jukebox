'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useVenue } from '@/lib/useVenue';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CONFIG, type Song, type VenueConfig } from '@/lib/types';

interface YTPlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  stopVideo: () => void;
}
interface YTNamespace {
  Player: new (el: string | HTMLElement, opts: unknown) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function PlayerClient({ venueId, email }: { venueId: string; email: string }) {
  const router = useRouter();
  const { queue, history, config } = useVenue(venueId);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState<{ title: string; video_id: string; table_label: string; isHistory: boolean } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const loadedRef = useRef<string>('');
  const currentRef = useRef<{ id: string; isHistory: boolean } | null>(null);
  const historyRef = useRef<Song[]>([]);
  const configRef = useRef<VenueConfig>(DEFAULT_CONFIG);
  const idleIdxRef = useRef(0);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  async function admin(action: string, extra: Record<string, unknown> = {}) {
    return fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, venueId, ...extra }),
    }).then((r) => r.json());
  }

  const loadVideo = useCallback((id: string) => {
    if (loadedRef.current === id) return;
    loadedRef.current = id;
    playerRef.current?.loadVideoById(id);
  }, []);

  const playIdle = useCallback(() => {
    const hist = historyRef.current;
    if (!configRef.current.playHistoryWhenIdle || hist.length === 0) {
      currentRef.current = null;
      setNow(null);
      return;
    }
    const order = [...hist].reverse(); // 由舊到新依序回放
    const idx = ((idleIdxRef.current % order.length) + order.length) % order.length;
    const pick = order[idx];
    currentRef.current = { id: pick.id, isHistory: true };
    loadVideo(pick.video_id);
    setNow({ title: pick.title, video_id: pick.video_id, table_label: pick.table_label, isHistory: true });
  }, [loadVideo]);

  const handleEnded = useCallback(() => {
    const cur = currentRef.current;
    if (cur && !cur.isHistory) {
      admin('markPlayed', { id: cur.id });
    } else {
      idleIdxRef.current += 1;
      playIdle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playIdle]);

  useEffect(() => {
    const createPlayer = () => {
      if (!window.YT) return;
      playerRef.current = new window.YT.Player('yt', {
        height: '100%',
        width: '100%',
        playerVars: { autoplay: 1, controls: 1, rel: 0, playsinline: 1 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === 0) handleEnded();
          },
        },
      });
    };
    if (window.YT?.Player) {
      createPlayer();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = createPlayer;
    }
  }, [handleEnded]);

  useEffect(() => {
    if (!started) return;
    const playing = queue.find((s) => s.status === 'playing');
    const waiting = queue.filter((s) => s.status === 'waiting');
    if (playing) {
      currentRef.current = { id: playing.id, isHistory: false };
      loadVideo(playing.video_id);
      setNow({ title: playing.title, video_id: playing.video_id, table_label: playing.table_label, isHistory: false });
    } else if (waiting.length > 0) {
      const next = waiting[0];
      currentRef.current = { id: next.id, isHistory: false };
      loadVideo(next.video_id);
      setNow({ title: next.title, video_id: next.video_id, table_label: next.table_label, isHistory: false });
      admin('markPlaying', { id: next.id });
    } else if (config.playHistoryWhenIdle && history.length > 0) {
      if (!currentRef.current?.isHistory) {
        idleIdxRef.current = 0;
        playIdle();
      }
    } else {
      currentRef.current = null;
      setNow(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, history, config, started]);

  function unlock() {
    setStarted(true);
    playerRef.current?.playVideo();
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const waiting = queue.filter((s) => s.status === 'waiting');

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* 舞台 */}
      <section className="relative flex flex-1 flex-col items-center justify-center p-6">
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="hidden sm:inline">{email}</span>
          <button onClick={() => setShowSettings(true)} className="card rounded-lg px-3 py-1.5">⚙️ 設定</button>
          <button onClick={logout} className="card rounded-lg px-3 py-1.5">登出</button>
        </div>

        <div className="absolute left-6 top-5 flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ember)]" />
          <span className="font-bold tracking-wide">點唱機</span>
        </div>

        <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          <div id="yt" className="h-full w-full" />
        </div>

        <div className="mt-5 text-center">
          {now ? (
            <>
              <div className="text-lg font-semibold">{now.title}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{now.isHistory ? '🎞️ 歷史回放' : `${now.table_label}桌 點播`}</div>
            </>
          ) : (
            <div className="text-[var(--faint)]">目前沒有歌曲播放</div>
          )}
        </div>

        {now && !now.isHistory && currentRef.current && (
          <div className="mt-4 flex gap-2">
            <button onClick={() => admin('skipSong', { id: currentRef.current!.id })} className="card rounded-xl px-5 py-2 text-sm font-bold">跳過</button>
            <button onClick={() => admin('clearQueue')} className="card rounded-xl px-5 py-2 text-sm font-bold">清空佇列</button>
          </div>
        )}

        {!started && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[rgba(14,11,9,0.92)] backdrop-blur-sm">
            <div className="vinyl h-28 w-28" />
            <p className="text-[var(--muted)]">點一下開始播放，之後自動接續</p>
            <button onClick={unlock} className="btn-ember rounded-xl px-8 py-3 text-base">▶ 開始播放</button>
          </div>
        )}
      </section>

      {/* 側欄 */}
      <aside className="w-full border-t border-[var(--border)] p-5 lg:w-96 lg:border-l lg:border-t-0">
        <h2 className="mb-3 text-sm font-bold">接下來播放</h2>
        {waiting.length === 0 ? (
          <p className="py-4 text-sm text-[var(--faint)]">佇列已空，等待新的點歌～</p>
        ) : (
          <div className="space-y-2">
            {waiting.map((s, i) => (
              <div key={s.id} className="card flex items-center gap-2 rounded-xl p-2">
                <span className="mono flex h-6 w-6 items-center justify-center rounded bg-[var(--glass)] text-xs">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.thumbnail || `https://i.ytimg.com/vi/${s.video_id}/default.jpg`} alt="" className="h-9 w-9 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
                <button onClick={() => admin('bumpSong', { id: s.id })} title="置頂" className="text-[var(--faint)] hover:text-[#ffb088]">⬆</button>
                <button onClick={() => admin('deleteSong', { id: s.id })} title="刪除" className="text-[var(--faint)] hover:text-[var(--danger)]">✕</button>
              </div>
            ))}
          </div>
        )}

        <h2 className="mb-3 mt-7 text-sm font-bold">🎞️ 歷史歌單</h2>
        {history.length === 0 ? (
          <p className="py-4 text-sm text-[var(--faint)]">還沒有播放紀錄</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 30).map((s) => (
              <div key={s.id} className="card flex items-center gap-2 rounded-xl p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.thumbnail || `https://i.ytimg.com/vi/${s.video_id}/default.jpg`} alt="" className="h-9 w-9 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">{s.title}</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {showSettings && <SettingsModal config={config} onClose={() => setShowSettings(false)} admin={admin} />}
    </main>
  );
}

function SettingsModal({
  config,
  onClose,
  admin,
}: {
  config: VenueConfig;
  onClose: () => void;
  admin: (action: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<VenueConfig>(config);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof VenueConfig>(k: K, v: VenueConfig[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  async function save() {
    setBusy(true);
    await admin('saveSettings', { config: draft });
    setBusy(false);
    onClose();
  }

  const num = (k: keyof VenueConfig, label: string) => (
    <label className="block">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        value={draft[k] as number}
        onChange={(e) => set(k, (parseInt(e.target.value, 10) || 0) as VenueConfig[typeof k])}
        className="input-ember mt-1 w-full rounded-lg px-3 py-2 text-sm"
      />
    </label>
  );
  const toggle = (k: keyof VenueConfig, label: string) => (
    <label className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <input type="checkbox" checked={draft[k] as boolean} onChange={(e) => set(k, e.target.checked as VenueConfig[typeof k])} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">設定</h2>
        <div className="space-y-3">
          {num('maxPerTable', '每桌可點幾首')}
          {num('cooldownMin', '點滿後冷卻（分鐘）')}
          {num('searchCount', '搜尋顯示筆數')}
          {num('dailySearchLimit', '每日搜尋上限')}
          {num('maxSongMin', '歌曲長度上限（分鐘，0=不限）')}
          {num('openHour', '開放點歌起（0-23）')}
          {num('closeHour', '開放點歌迄（0-24，與起相同=全天）')}
          {num('skipVotesNeeded', '跳過投票門檻（0=關閉）')}
          {num('bumpPrice', '插播費用（元）')}
          <label className="block">
            <span className="text-sm">黑名單關鍵字（逗號分隔）</span>
            <input
              type="text"
              value={draft.blockWords}
              onChange={(e) => set('blockWords', e.target.value)}
              className="input-ember mt-1 w-full rounded-lg px-3 py-2 text-sm"
            />
          </label>
          {toggle('musicOnly', '只搜音樂類別')}
          {toggle('playHistoryWhenIdle', '無佇列時播放歷史歌單')}
          {toggle('paidBumpEnabled', '開放客人付費插播')}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="card rounded-xl px-4 py-2 text-sm">取消</button>
          <button onClick={save} disabled={busy} className="btn-ember rounded-xl px-4 py-2 text-sm disabled:opacity-50">
            {busy ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
