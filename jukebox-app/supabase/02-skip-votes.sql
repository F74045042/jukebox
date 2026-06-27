-- ============================================================
-- 跳過投票（vote-skip）。在 Supabase ▸ SQL Editor 貼上執行一次（可重複執行）。
-- ============================================================
create table if not exists public.skip_votes (
  venue_id    uuid not null references public.venues(id) on delete cascade,
  song_id     uuid not null references public.songs(id) on delete cascade,
  table_label text not null,
  created_at  timestamptz not null default now(),
  primary key (song_id, table_label)   -- 每桌每首只能投一票
);

alter table public.skip_votes enable row level security;

-- 開放讀取，讓客人即時看到投票進度（venue_id 不可猜、內容不敏感）。寫入由後端 service role 處理。
drop policy if exists skipvotes_public_select on public.skip_votes;
create policy skipvotes_public_select on public.skip_votes for select using (true);

-- 即時推播票數
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='skip_votes') then
    alter publication supabase_realtime add table public.skip_votes;
  end if;
end $$;
