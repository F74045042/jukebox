-- ============================================================
-- 點唱機 SaaS — Supabase schema（Phase 1，已為多租戶預留）
-- 用法：Supabase Dashboard ▸ SQL Editor ▸ 貼上整段 ▸ Run
-- 這段可重複執行（用 if not exists / drop policy if exists）。
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 店家（租戶） ----------
create table if not exists public.venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '我的店',
  created_at  timestamptz not null default now()
);

-- ---------- 店家成員（哪些登入帳號能管理哪家店；對應 player 登入） ----------
create table if not exists public.venue_members (
  venue_id   uuid not null references public.venues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

-- ---------- 每店設定（沿用現有設定，用 jsonb 方便日後擴充） ----------
create table if not exists public.venue_settings (
  venue_id   uuid primary key references public.venues(id) on delete cascade,
  config     jsonb not null default jsonb_build_object(
    'cooldownMin', 0, 'maxPerTable', 3, 'playHistoryWhenIdle', false,
    'dailySearchLimit', 95, 'searchCount', 8, 'musicOnly', true, 'blockWords', '',
    'maxSongMin', 0, 'openHour', 0, 'closeHour', 0, 'skipVotesNeeded', 0,
    'paidBumpEnabled', false, 'bumpPrice', 0
  ),
  updated_at timestamptz not null default now()
);

-- ---------- 歌曲（佇列 + 歷史，用 status 區分；取代原本兩張 Sheet） ----------
create table if not exists public.songs (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues(id) on delete cascade,
  table_label text not null default '',
  video_id    text not null,
  title       text not null,
  thumbnail   text not null default '',
  status      text not null default 'waiting' check (status in ('waiting','playing','played')),
  position    double precision not null default 0,   -- 排序用；插播設更小值即可排到最前
  created_at  timestamptz not null default now(),
  played_at   timestamptz
);
create index if not exists songs_venue_status_idx on public.songs (venue_id, status, position);
create index if not exists songs_venue_played_idx on public.songs (venue_id, played_at desc);

-- 每桌冷卻起算時間（沿用「點滿上限才開始冷卻」邏輯）
create table if not exists public.table_cooldowns (
  venue_id    uuid not null references public.venues(id) on delete cascade,
  table_label text not null,
  started_at  timestamptz,
  primary key (venue_id, table_label)
);

-- 每日搜尋配額（每店一份，跨日自動歸零由後端判斷 day 欄位）
create table if not exists public.search_quota (
  venue_id  uuid primary key references public.venues(id) on delete cascade,
  day       date not null default current_date,
  count     int  not null default 0
);

-- 建店時自動建立預設設定列
create or replace function public.tg_venue_defaults()
returns trigger language plpgsql security definer as $$
begin
  insert into public.venue_settings(venue_id) values (new.id) on conflict do nothing;
  return new;
end; $$;
drop trigger if exists venue_defaults on public.venues;
create trigger venue_defaults after insert on public.venues
  for each row execute function public.tg_venue_defaults();

-- ============================================================
-- Row Level Security
--   讀取（含 realtime 訂閱）：songs / venue_settings 對所有人開放
--     —— venue_id 是不可猜的 UUID，且佇列內容不敏感；這樣客人(匿名)才能即時看佇列。
--   寫入有商業邏輯者：一律走 Next.js 後端（service role 金鑰），不直接從前端寫。
--   店家管理動作：限該店成員（已登入）。
-- ============================================================
alter table public.venues          enable row level security;
alter table public.venue_members   enable row level security;
alter table public.venue_settings  enable row level security;
alter table public.songs           enable row level security;
alter table public.table_cooldowns enable row level security;
alter table public.search_quota    enable row level security;

-- 是否為某店成員（security definer 以避開對 venue_members 的 RLS 遞迴）
create or replace function public.is_member(v uuid)
returns boolean language sql security definer stable as $$
  select exists(select 1 from public.venue_members m where m.venue_id = v and m.user_id = auth.uid());
$$;

drop policy if exists venues_member_select on public.venues;
create policy venues_member_select on public.venues for select using (public.is_member(id));
drop policy if exists venues_member_update on public.venues;
create policy venues_member_update on public.venues for update using (public.is_member(id));

drop policy if exists members_self_select on public.venue_members;
create policy members_self_select on public.venue_members for select using (user_id = auth.uid());

drop policy if exists settings_public_select on public.venue_settings;
create policy settings_public_select on public.venue_settings for select using (true);
drop policy if exists settings_member_write on public.venue_settings;
create policy settings_member_write on public.venue_settings for all
  using (public.is_member(venue_id)) with check (public.is_member(venue_id));

drop policy if exists songs_public_select on public.songs;
create policy songs_public_select on public.songs for select using (true);
drop policy if exists songs_member_write on public.songs;
create policy songs_member_write on public.songs for all
  using (public.is_member(venue_id)) with check (public.is_member(venue_id));
-- table_cooldowns / search_quota：不開任何前端政策，只由後端 service role 存取。

-- ---------- 開啟 Realtime（客人/平板即時收到佇列與設定變動） ----------
alter publication supabase_realtime add table public.songs;
alter publication supabase_realtime add table public.venue_settings;

-- ============================================================
-- 一次性 seed（Phase 1 單店）：建立你的店 + 把你的登入帳號設為店主
--   先到 Authentication ▸ Users 用 email 建好你的 player 登入帳號，
--   然後把下面的 email 換成它，整段執行一次即可。
-- ============================================================
-- do $$
-- declare v_user uuid; v_venue uuid;
-- begin
--   select id into v_user from auth.users where email = '你的@email.com';
--   insert into public.venues(name) values ('我的店') returning id into v_venue;
--   insert into public.venue_members(venue_id, user_id, role) values (v_venue, v_user, 'owner');
--   raise notice '你的 venue_id = %', v_venue;   -- 記下這組 ID，customer/player 會用到
-- end $$;
