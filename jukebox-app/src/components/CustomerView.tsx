'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useVenue } from '@/lib/useVenue';
import { tr, type Lang } from '@/lib/i18n';
import type { SearchResult } from '@/lib/types';

const PLAYLISTS = [
  { name: '經典華語', q: '經典華語 老歌' },
  { name: 'Chill 放鬆', q: 'chill 放鬆 歌單' },
  { name: 'K-POP 熱門', q: 'kpop hits' },
  { name: '東洋金曲', q: '日本 熱門 歌' },
  { name: '西洋流行', q: 'pop hits' },
];

// 玻璃卡片共用樣式
const glass: CSSProperties = {
  background: 'var(--glass-grad)',
  border: '1px solid var(--glass-border)',
  boxShadow: 'inset 0 1px 0 var(--glass-hi)',
};
const btnPrimary: CSSProperties = {
  border: 'none',
  cursor: 'pointer',
  color: 'var(--on-accent)',
  background: 'linear-gradient(180deg,rgba(255,255,255,.3),rgba(255,255,255,0) 52%),var(--btn-bg)',
  boxShadow: 'var(--glow), inset 0 1px 0 rgba(255,255,255,.5)',
  fontWeight: 800,
};

export default function CustomerView({ venueId }: { venueId: string }) {
  const { queue, config, skipVotes } = useVenue(venueId);
  const [table, setTable] = useState('未指定');
  const [lang, setLang] = useState<Lang>('zh');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState('');
  const [confirm, setConfirm] = useState<SearchResult | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('table');
    if (t) setTable(t);
    const saved = localStorage.getItem('jukebox_lang') as Lang | null;
    if (saved) setLang(saved);
  }, []);

  const t = (key: string, params?: Record<string, string | number>) => tr(lang, key, params);
  function changeLang(l: Lang) {
    setLang(l);
    localStorage.setItem('jukebox_lang', l);
  }
  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  }

  const playing = useMemo(() => queue.find((s) => s.status === 'playing'), [queue]);
  const waiting = useMemo(() => queue.filter((s) => s.status === 'waiting'), [queue]);
  const firstWaitingId = waiting[0]?.id;
  const myCount = waiting.filter((s) => s.table_label === table).length;
  const remaining = Math.max(0, config.maxPerTable - myCount);
  const theme = config.theme || 'retro';

  async function doSearch(term?: string) {
    const q = (term ?? query).trim();
    if (!q) return;
    if (term) setQuery(term);
    setSearching(true);
    setResults([]);
    try {
      const r = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, venueId }),
      }).then((x) => x.json());
      if (r.success) setResults(r.results || []);
      else if (r.error === 'QUOTA_EXCEEDED') flash(t('quotaOut'));
      else flash(t('searchFail'));
    } catch {
      flash(t('connFail'));
    } finally {
      setSearching(false);
    }
  }

  async function confirmAdd() {
    const r = confirm;
    if (!r) return;
    setConfirm(null);
    setQuery('');
    setResults([]);
    flash(t('added'));
    try {
      const res = await fetch('/api/request-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, venueId, videoId: r.videoId, title: r.title, thumbnail: r.thumbnail }),
      }).then((x) => x.json());
      if (!res.success) flash(res.message || t('addFail'));
    } catch {
      flash(t('connFail'));
    }
  }

  async function voteSkip(id: string) {
    try {
      const res = await fetch('/api/vote-skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, table, venueId }),
      }).then((x) => x.json());
      if (res.success) flash(res.skipped ? t('voteSkipped') : t('voteDone', { a: res.votes, b: res.needed }));
      else if (res.error !== 'DISABLED') flash(t('voteFail'));
    } catch {
      flash(t('connFail'));
    }
  }

  async function paidBump(id: string) {
    const cost = config.bumpPrice > 0 ? t('bumpPaid', { p: config.bumpPrice }) : t('bumpFree');
    if (!window.confirm(t('bumpConfirm', { c: cost }))) return;
    try {
      const res = await fetch('/api/paid-bump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, table, venueId }),
      }).then((x) => x.json());
      flash(res.success ? t('bumpDone') : res.message || t('bumpFail'));
    } catch {
      flash(t('connFail'));
    }
  }

  const langBtn = (l: Lang, label: string) => (
    <span
      onClick={() => changeLang(l)}
      style={{
        padding: '4px 8px',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 800,
        cursor: 'pointer',
        color: lang === l ? 'var(--on-accent)' : 'var(--muted)',
        background: lang === l ? 'var(--accent)' : 'transparent',
      }}
    >
      {label}
    </span>
  );

  return (
    <main data-theme={theme} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'var(--phone-bg)', animation: 'meshDrift 16s ease-in-out infinite', pointerEvents: 'none' }} />

      {/* 內容 */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', width: '100%', maxWidth: 480, margin: '0 auto', padding: 'max(18px, env(safe-area-inset-top)) 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 23, boxShadow: 'var(--glow), inset 0 1px 0 var(--glass-hi)', ...glass }}>♫</div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontFamily: 'var(--head-font)', fontWeight: 900, fontSize: 23, color: 'var(--text)', textShadow: 'var(--text-glow)', letterSpacing: '.5px' }}>點唱機</div>
              <div style={{ fontFamily: 'var(--logo-font)', fontSize: 12, letterSpacing: '3px', color: 'var(--accent)', marginTop: 4, textTransform: 'uppercase' }}>Jukebox</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, padding: 4, borderRadius: 12, ...glass }}>
            {langBtn('zh', '中')}
            {langBtn('en', 'EN')}
            {langBtn('ja', '日')}
          </div>
        </div>

        {/* pills */}
        <div style={{ display: 'flex', gap: 9 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, color: 'var(--muted)', ...glass }}>
            {t('table')} <b style={{ color: 'var(--text)' }}>{table}</b>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, color: 'var(--muted)', ...glass }}>
            {t('canOrder')} <b style={{ color: 'var(--accent)' }}>{remaining}</b> {t('unit')}
          </span>
        </div>

        {/* search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px', borderRadius: 'var(--radius)', color: 'var(--text)', ...glass }}>
          <span style={{ color: 'var(--accent)', fontSize: 15 }}>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder={t('searchPh')}
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 500, outline: 'none' }}
          />
          {query && <span onClick={() => { setQuery(''); setResults([]); }} style={{ cursor: 'pointer', color: 'var(--faint)', fontSize: 14 }}>✕</span>}
          {searching && <span style={{ color: 'var(--faint)', fontSize: 12 }}>…</span>}
        </div>

        {/* results (query mode) */}
        {query.trim() ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {results.map((r) => (
              <div key={r.videoId} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 10, borderRadius: 14, ...glass }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.thumbnail} alt="" style={{ width: 40, height: 40, borderRadius: 11, objectFit: 'cover', flexShrink: 0 }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.channel}</span>
                </span>
                <button onClick={() => setConfirm(r)} style={{ padding: '8px 14px', borderRadius: 11, fontSize: 12.5, ...btnPrimary }}>{t('addSongBtn')}</button>
              </div>
            ))}
            {!searching && results.length === 0 && (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--faint)', fontSize: 13.5 }}>{t('noMatch', { q: query.trim() })}</div>
            )}
          </div>
        ) : (
          /* browse mode */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 9, overflowX: 'auto', paddingBottom: 2 }}>
              {PLAYLISTS.map((p) => (
                <span key={p.name} onClick={() => doSearch(p.q)} style={{ whiteSpace: 'nowrap', padding: '9px 15px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: 'var(--muted)', ...glass }}>{p.name}</span>
              ))}
            </div>

            {playing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(180deg,var(--accent-soft),transparent 70%),var(--glass-grad)', border: '1px solid var(--border)', boxShadow: 'var(--glass-shadow), inset 0 1px 0 var(--glass-hi)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={playing.thumbnail || `https://i.ytimg.com/vi/${playing.video_id}/default.jpg`} alt="" style={{ width: 50, height: 50, borderRadius: 13, objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '1px', color: 'var(--accent)' }}>● {t('nowPlaying')}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{playing.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{playing.table_label}{t('table') === '桌號' ? '桌' : ''}</div>
                </div>
                {config.skipVotesNeeded > 0 ? (
                  <button onClick={() => voteSkip(playing.id)} style={{ flexShrink: 0, padding: '7px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, color: 'var(--muted)', ...glass }}>
                    {t('vote', { a: skipVotes, b: config.skipVotesNeeded })}
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 24 }}>
                    {[0, 0.25, 0.45].map((d) => (
                      <span key={d} style={{ width: 3.5, height: '100%', borderRadius: 2, background: 'var(--accent)', transformOrigin: 'bottom', animation: `eqbar 1s ease-in-out infinite`, animationDelay: `${d}s` }} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* bottom bar */}
      <div style={{ position: 'relative', zIndex: 2, flexShrink: 0, margin: '0 10px calc(10px + env(safe-area-inset-bottom))', maxWidth: 480, width: 'calc(100% - 20px)', alignSelf: 'center', borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(22px)', ...glass, boxShadow: 'var(--glass-shadow), inset 0 1px 0 var(--glass-hi)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 16, background: 'rgba(255,255,255,.08)', border: '1px solid var(--glass-border)' }}>♪</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{t('myOrders')}</div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{t('inQueueN', { n: waiting.length })}</div>
          </div>
        </div>
        <button onClick={() => setQueueOpen(true)} style={{ padding: '10px 16px', borderRadius: 13, fontSize: 12.5, ...btnPrimary }}>
          {t('view')} <b style={{ marginLeft: 4 }}>{waiting.length}</b>
        </button>
      </div>

      {/* queue sheet */}
      {queueOpen && (
        <>
          <div onClick={() => setQueueOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,.45)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 21, maxHeight: '78%', display: 'flex', flexDirection: 'column', borderRadius: '28px 28px 0 0', padding: '8px 14px calc(16px + env(safe-area-inset-bottom))', animation: 'sheetUp .3s ease', maxWidth: 480, margin: '0 auto', backdropFilter: 'blur(34px)', ...glass }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 10px' }}><span style={{ width: 38, height: 4, borderRadius: 3, background: 'rgba(255,255,255,.35)' }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 10px' }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>{t('queueTitle')}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-accent)', background: 'var(--btn-bg)', padding: '3px 10px', borderRadius: 999 }}>{waiting.length}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {waiting.length === 0 && <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>{t('empty')}</div>}
              {waiting.map((s, i) => {
                const mine = s.table_label === table;
                const canBump = config.paidBumpEnabled && mine && s.id !== firstWaitingId;
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 10, borderRadius: 14, animation: 'popIn .3s ease', ...(mine ? { background: 'var(--accent-soft)', border: '1px solid var(--border)' } : {}) }}>
                    <span style={{ width: 20, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{i + 1}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.table_label}</span>
                    </span>
                    {canBump && <button onClick={() => paidBump(s.id)} style={{ fontSize: 10, borderRadius: 8, padding: '4px 8px', ...btnPrimary }}>{t('bump')}</button>}
                    {mine && <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '3px 7px', borderRadius: 8 }}>{t('mine')}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* confirm sheet */}
      {confirm && (
        <div onClick={() => setConfirm(null)} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div data-theme={theme} onClick={(e) => e.stopPropagation()} style={{ width: 340, maxWidth: '90vw', padding: 22, borderRadius: 24, animation: 'popIn .25s ease', background: 'var(--phone-bg)', border: '1px solid var(--glass-border)', boxShadow: '0 40px 90px -24px rgba(0,0,0,.65)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', marginBottom: 14 }}>{t('confirmHead')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 13, borderRadius: 15, ...glass, marginBottom: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={confirm.thumbnail} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{confirm.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{confirm.channel}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 18 }}>{t('confirmNote', { pos: waiting.length + 1, r: remaining })}</div>
            <div style={{ display: 'flex', gap: 11 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: 13, border: '1px solid var(--glass-border)', borderRadius: 14, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'var(--muted)', background: 'transparent' }}>{t('cancel')}</button>
              <button onClick={confirmAdd} style={{ flex: 1.5, padding: 13, borderRadius: 14, fontSize: 14, ...btnPrimary }}>{t('confirmAdd')}</button>
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 44, transform: 'translateX(-50%)', zIndex: 90, display: 'flex', alignItems: 'center', gap: 11, padding: '13px 20px', borderRadius: 15, animation: 'toastIn .3s ease', background: 'linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.06)),rgba(20,18,26,.6)', backdropFilter: 'blur(26px)', border: '1px solid rgba(255,255,255,.22)', color: '#fff' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{toast}</span>
        </div>
      )}
    </main>
  );
}
