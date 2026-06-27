-- ============================================================
-- 歷史歌單編輯（刪除 + 拖曳排序）。Supabase ▸ SQL Editor 貼上執行一次（可重複）。
-- ============================================================
alter table public.songs add column if not exists hidden boolean not null default false;
alter table public.songs add column if not exists replay_position double precision;
create index if not exists songs_venue_replay_idx on public.songs (venue_id, status, replay_position);
