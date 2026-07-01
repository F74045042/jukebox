'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVenue } from '@/lib/useVenue';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CONFIG, type Song, type VenueConfig } from '@/lib/types';
import { parseLrc, type LyricLine } from '@/lib/lyrics';

interface YTPlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  stopVideo: () => void;
  setVolume: (v: number) => void;
  unMute: () => void;
  getCurrentTime: () => number;
  loadModule?: (module: string) => void;
  getOption?: (module: string, option: string) => unknown;
  setOption?: (module: string, option: string, value: unknown) => void;
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
  const [now, setNow] = useState<{ id: string; title: string; video_id: string; table_label: string; isHistory: boolean } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<'music' | 'mv' | 'ktv'>('music');

  const playerRef = useRef<YTPlayer | null>(null);
  const loadedKeyRef = useRef<string>(''); // songId + 模式(原曲/伴唱)，避免重複載入
  const currentRef = useRef<{ id: string; isHistory: boolean } | null>(null);
  const historyRef = useRef<Song[]>([]);
  const configRef = useRef<VenueConfig>(DEFAULT_CONFIG);
  const idleIdxRef = useRef(0);

  // KTV 歌詞
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricStatus, setLyricStatus] = useState<'idle' | 'checking' | 'cc' | 'loading' | 'synced' | 'plain' | 'none'>('idle');
  const [activeLine, setActiveLine] = useState(-1);
  const [lyricMatch, setLyricMatch] = useState('');
  const [offset, setOffset] = useState(0); // 秒；正值=歌詞提早顯示

  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  // 跟隨後端設定的預設/同步模式
  useEffect(() => {
    if (config.playerMode) setMode(config.playerMode);
  }, [config.playerMode]);

  async function admin(action: string, extra: Record<string, unknown> = {}) {
    return fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, venueId, ...extra }),
    }).then((r) => r.json());
  }

  const loadFor = useCallback(
    (song: { id: string; video_id: string; title: string; table_label: string }, isHistory: boolean) => {
      currentRef.current = { id: song.id, isHistory };
      setNow({ id: song.id, title: song.title, video_id: song.video_id, table_label: song.table_label, isHistory });
      if (loadedKeyRef.current === song.id) return;
      loadedKeyRef.current = song.id;
      playerRef.current?.loadVideoById(song.video_id);
    },
    [],
  );

  const playIdle = useCallback(() => {
    const hist = historyRef.current;
    if (!configRef.current.playHistoryWhenIdle || hist.length === 0) {
      currentRef.current = null;
      setNow(null);
      loadedKeyRef.current = '';
      return;
    }
    // history 已是「回放順序」（清單由上到下），依序播、循環
    const idx = ((idleIdxRef.current % hist.length) + hist.length) % hist.length;
    loadFor(hist[idx], true);
  }, [loadFor]);

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
        playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, modestbranding: 1, iv_load_policy: 3 },
        events: {
          onReady: () => {
            playerRef.current?.unMute();
            playerRef.current?.setVolume(100);
          },
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
      loadFor(playing, false);
    } else if (waiting.length > 0) {
      const next = waiting[0];
      loadFor(next, false);
      admin('markPlaying', { id: next.id });
    } else if (config.playHistoryWhenIdle && history.length > 0) {
      if (!currentRef.current?.isHistory) {
        idleIdxRef.current = 0;
        playIdle();
      }
    } else {
      currentRef.current = null;
      setNow(null);
      loadedKeyRef.current = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, history, config, started, mode]);

  function setModeAndSave(m: 'music' | 'mv' | 'ktv') {
    setMode(m);
    admin('saveSettings', { config: { playerMode: m } });
  }

  // YouTube 內建字幕（CC）控制：模組名在不同播放器版本可能是 captions 或 cc
  function ccTracklist(): unknown[] {
    const p = playerRef.current;
    if (!p?.getOption) return [];
    for (const m of ['captions', 'cc']) {
      try {
        const tl = p.getOption(m, 'tracklist');
        if (Array.isArray(tl) && tl.length) return tl;
      } catch {
        /* 舊版播放器沒有此模組 */
      }
    }
    return [];
  }
  function ccSet(track: unknown | null) {
    const p = playerRef.current;
    if (!p?.setOption) return;
    for (const m of ['captions', 'cc']) {
      try {
        p.setOption(m, 'track', track ?? {});
      } catch {
        /* 忽略 */
      }
    }
  }

  // KTV：換歌時先看影片有沒有字幕(CC)，有就用影片字幕，沒有才退回 LRCLIB 歌詞
  useEffect(() => {
    if (mode !== 'ktv' || !now) {
      ccSet(null); // 離開 KTV 時關掉字幕
      setLyrics([]);
      setLyricStatus('idle');
      setActiveLine(-1);
      return;
    }
    let cancelled = false;
    setLyrics([]);
    setActiveLine(-1);
    setOffset(0);
    setLyricMatch('');
    setLyricStatus('checking');

    const fetchLyrics = () => {
      setLyricStatus('loading');
      fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: now.title }),
      })
        .then((x) => x.json())
        .then((r) => {
          if (cancelled) return;
          setLyricMatch(r.success && r.track ? `${r.track}${r.artist ? ' - ' + r.artist : ''}` : '');
          if (r.success && r.synced) {
            setLyrics(parseLrc(r.synced));
            setLyricStatus('synced');
          } else if (r.success && r.plain) {
            setLyrics(String(r.plain).split('\n').map((s) => s.trim()).filter(Boolean).map((t) => ({ t: -1, text: t })));
            setLyricStatus('plain');
          } else {
            setLyricStatus('none');
          }
        })
        .catch(() => {
          if (!cancelled) setLyricStatus('none');
        });
    };

    // 先偵測影片字幕（模組載入需要一點時間，輪詢幾秒）
    try { playerRef.current?.loadModule?.('captions'); } catch { /* noop */ }
    let tries = 0;
    const poll = setInterval(() => {
      if (cancelled) { clearInterval(poll); return; }
      tries++;
      const tl = ccTracklist();
      if (tl.length) {
        ccSet(tl[0]); // 開啟影片內建字幕
        setLyricStatus('cc');
        clearInterval(poll);
      } else if (tries >= 8) {
        clearInterval(poll);
        fetchLyrics(); // 影片沒字幕 → 退回歌詞庫
      }
    }, 400);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, now?.video_id]);

  // KTV：依播放進度高亮目前歌詞行
  useEffect(() => {
    if (mode !== 'ktv' || lyricStatus !== 'synced' || lyrics.length === 0) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const tt = p.getCurrentTime() + offset;
      let idx = -1;
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].t <= tt) idx = i;
        else break;
      }
      setActiveLine(idx);
    }, 300);
    return () => clearInterval(id);
  }, [mode, lyricStatus, lyrics, offset]);

  function unlock() {
    setStarted(true);
    playerRef.current?.unMute();
    playerRef.current?.setVolume(100);
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
          <Link href="/dashboard" className="card rounded-lg px-3 py-1.5">← 後台</Link>
          <button onClick={() => setShowSettings(true)} className="card rounded-lg px-3 py-1.5">⚙️ 設定</button>
          <button onClick={logout} className="card rounded-lg px-3 py-1.5">登出</button>
        </div>

        <div className="absolute left-6 top-5 flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ember)]" />
          <span className="font-bold tracking-wide">點唱機</span>
        </div>

        {/* 模式切換 */}
        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 gap-1">
          {([['music', '🎵 播歌'], ['mv', '📺 MV'], ['ktv', '🎤 KTV']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setModeAndSave(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === m ? 'seg-on border' : 'card text-[var(--muted)]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          {/* MV 模式裁掉 YouTube 上下列；播歌/KTV 用滿版 */}
          <div className={mode === 'mv' ? 'absolute -inset-[9%]' : 'absolute inset-0'}>
            <div id="yt" className="h-full w-full" />
          </div>
          {/* MV / KTV：擋住點擊，客人不能暫停或點進 YouTube */}
          {(mode === 'mv' || mode === 'ktv') && <div className="absolute inset-0 z-10" />}
          {/* 播歌模式：不透明黑膠蓋住影片，只剩聲音 */}
          {mode === 'music' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--bg)]">
              <div className="vinyl h-44 w-44 sm:h-60 sm:w-60">
                {now && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="vinyl-label" src={`https://i.ytimg.com/vi/${now.video_id}/hqdefault.jpg`} alt="" />
                )}
              </div>
            </div>
          )}

          {/* KTV：用影片字幕(CC)時顯示影片＋小標；偵測中也顯示影片 */}
          {mode === 'ktv' && lyricStatus === 'cc' && (
            <div className="absolute left-2 top-2 z-30 rounded bg-black/50 px-2 py-1 text-xs text-[var(--faint)]">🎬 跟著影片字幕唱</div>
          )}
          {mode === 'ktv' && lyricStatus === 'checking' && (
            <div className="absolute left-2 top-2 z-30 rounded bg-black/50 px-2 py-1 text-xs text-[var(--faint)]">偵測影片字幕中…</div>
          )}

          {/* KTV：影片沒字幕 → 歌詞疊在（變暗的）影片上 */}
          {mode === 'ktv' && (lyricStatus === 'loading' || lyricStatus === 'synced' || lyricStatus === 'plain' || lyricStatus === 'none') && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 px-6 text-center">
              {lyricStatus === 'loading' && <p className="text-[var(--muted)]">載入歌詞中…</p>}
              {lyricStatus === 'none' && (
                <p className="text-[var(--muted)]">找不到這首的歌詞 🎤<br />可改用 📺 MV 模式</p>
              )}
              {lyricStatus === 'synced' && (
                <div className="w-full max-w-2xl space-y-3">
                  {[-1, 0, 1, 2].map((d) => {
                    const line = lyrics[activeLine + d];
                    const isCur = d === 0;
                    return (
                      <p key={d} className={isCur ? 'text-2xl font-bold text-[#ffcf9e] sm:text-3xl' : 'text-base text-[var(--muted)] sm:text-lg'}>
                        {line ? line.text || '♪' : ''}
                      </p>
                    );
                  })}
                </div>
              )}
              {lyricStatus === 'plain' && (
                <div className="max-h-full max-w-2xl space-y-1 overflow-hidden text-base text-[var(--text)]">
                  {lyrics.slice(0, 10).map((l, i) => (
                    <p key={i}>{l.text}</p>
                  ))}
                  <p className="pt-2 text-xs text-[var(--faint)]">（此歌只有非同步歌詞，無法逐句高亮）</p>
                </div>
              )}
            </div>
          )}
          {mode === 'ktv' && lyricMatch && (lyricStatus === 'synced' || lyricStatus === 'plain') && (
            <div className="absolute left-2 top-2 z-30 max-w-[60%] truncate rounded bg-black/50 px-2 py-1 text-xs text-[var(--faint)]">
              🎵 {lyricMatch}
            </div>
          )}
          {mode === 'ktv' && lyricStatus === 'synced' && (
            <div className="absolute bottom-2 right-2 z-30 flex items-center gap-1 text-xs">
              <button onClick={() => setOffset((o) => o - 0.5)} className="card rounded px-2 py-1">歌詞慢</button>
              <span className="mono w-12 text-center text-[var(--faint)]">{offset > 0 ? '+' : ''}{offset.toFixed(1)}s</span>
              <button onClick={() => setOffset((o) => o + 0.5)} className="card rounded px-2 py-1">歌詞快</button>
            </div>
          )}
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

        {now && !now.isHistory && (
          <div className="mt-4 flex gap-2">
            <button onClick={() => admin('skipSong', { id: now.id })} className="card rounded-xl px-5 py-2 text-sm font-bold">跳過</button>
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

        <h2 className="mb-1 mt-7 text-sm font-bold">🎞️ 歷史歌單</h2>
        <p className="mb-3 text-xs text-[var(--faint)]">拖曳排序＝無佇列時的回放順序；✕ 從回放清單移除</p>
        <HistoryList
          history={history}
          onReorder={(ids) => admin('reorderHistory', { ids })}
          onDelete={(id) => admin('hideHistory', { id })}
        />
      </aside>

      {showSettings && <SettingsModal config={config} onClose={() => setShowSettings(false)} admin={admin} />}
    </main>
  );
}

function HistoryList({
  history,
  onReorder,
  onDelete,
}: {
  history: Song[];
  onReorder: (ids: string[]) => void;
  onDelete: (id: string) => void;
}) {
  const [items, setItems] = useState<Song[]>(history);
  const draggingRef = useRef(false);
  const dragId = useRef<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!draggingRef.current) setItems(history);
  }, [history]);

  function onMove(e: PointerEvent) {
    const id = dragId.current;
    if (!id) return;
    const y = e.clientY;
    setItems((prev) => {
      const arr = [...prev];
      const from = arr.findIndex((s) => s.id === id);
      if (from < 0) return prev;
      let to = arr.length - 1;
      for (let i = 0; i < arr.length; i++) {
        const el = rowRefs.current[arr[i].id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (y < r.top + r.height / 2) {
          to = i;
          break;
        }
      }
      if (to === from) return prev;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    draggingRef.current = false;
    dragId.current = null;
    setItems((cur) => {
      onReorder(cur.map((s) => s.id));
      return cur;
    });
  }
  function onPointerDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    draggingRef.current = true;
    dragId.current = id;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }
  function del(id: string) {
    setItems((prev) => prev.filter((s) => s.id !== id));
    onDelete(id);
  }

  if (items.length === 0) return <p className="py-4 text-sm text-[var(--faint)]">還沒有播放紀錄</p>;
  return (
    <div className="space-y-2">
      {items.map((s) => (
        <div
          key={s.id}
          ref={(el) => {
            rowRefs.current[s.id] = el;
          }}
          className="card flex items-center gap-2 rounded-xl p-2"
        >
          <button onPointerDown={(e) => onPointerDown(e, s.id)} title="拖曳排序" className="cursor-grab touch-none px-1 text-lg leading-none text-[var(--faint)]">
            ⠿
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.thumbnail || `https://i.ytimg.com/vi/${s.video_id}/default.jpg`} alt="" className="h-9 w-9 rounded object-cover" />
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">{s.title}</span>
          <button onClick={() => del(s.id)} title="從回放清單移除" className="text-[var(--faint)] hover:text-[var(--danger)]">✕</button>
        </div>
      ))}
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border-strong)] bg-[#1b1511] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
