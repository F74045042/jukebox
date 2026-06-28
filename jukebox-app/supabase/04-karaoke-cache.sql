-- ============================================================
-- KTV 模式：YouTube 伴唱版對照快取（全店共用，省配額）。
-- Supabase ▸ SQL Editor 貼上執行一次（可重複）。
-- ============================================================
create table if not exists public.karaoke_cache (
  video_id          text primary key,   -- 原曲 YouTube videoId
  karaoke_video_id  text,               -- 對應的伴唱版 videoId
  title             text,
  created_at        timestamptz not null default now()
);

-- 只由後端 service role 存取，不開前端政策
alter table public.karaoke_cache enable row level security;
