# 點唱機 SaaS — Phase 1 設定步驟

新平台（Next.js + Supabase）與現有的 GitHub Pages 站台**並存**，舊店面照常營業，新版在這裡開發。

## 你要做的（需要登入/帳號的部分）

1. **建立 Supabase 專案** — https://supabase.com → New project（選離台灣近的區域，如 Singapore）。記下資料庫密碼。
2. **建立資料表** — 左側 SQL Editor → 貼上 `supabase/schema.sql` 整段 → Run。
3. **建立 player 登入帳號** — Authentication ▸ Users ▸ Add user，用 email + 密碼（這就是平板登入用的）。
4. **seed 單店** — 回 SQL Editor，把 `schema.sql` 最底部被註解的 `do $$ ... $$` 區塊解除註解，email 換成步驟 3 的帳號，執行一次。它會印出 `venue_id`，記下來。
5. **拿金鑰** — Project Settings ▸ API，複製 `Project URL`、`anon key`、`service_role key`。
6. **填環境變數** — 把本資料夾的 `.env.local.example` 複製成 `.env.local`，填入步驟 5 的三個值、你的 YouTube 金鑰、步驟 4 的 venue_id。

做完上面，把這三個值貼給我（URL、anon key、venue_id 可公開；service_role 與 YouTube 金鑰請貼在你本機的 `.env.local`，**不要貼到對話**，我會以變數名稱引用）：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEFAULT_VENUE_ID`

## 我接著做

- 移植 `customer`（不需登入，realtime 即時佇列）與 `player`（需登入）兩頁到 Next.js。
- 點歌/插播/跳過/設定改走 Next.js API（service role + 後端驗證），realtime 即時推播取代輪詢 → 點歌「按下即出現」。
- 本機 `npm run dev` 驗證，之後部署到 Vercel。

## 本機開發

```
npm run dev    # http://localhost:3000
```
