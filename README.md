# 點唱機 — 即時點歌系統（多租戶 SaaS）

餐廳／店家用的線上點歌系統：客人掃桌上 QR Code 點歌，店家平板登入後自動依序播放。
支援多店（每家店資料隔離）、即時同步、三種播放模式。

- **正式站**：https://jukebox-sandy-ten.vercel.app
- **原始碼**：本 repo 的 [`jukebox-app/`](jukebox-app/)（Next.js）

> 舊版（Google Apps Script + GitHub Pages 靜態頁）已淘汰，相關檔案已移除。

---

## 技術架構

| 層 | 技術 |
|---|---|
| 前端 / App | **Next.js 16**（App Router, TypeScript, Tailwind），部署於 **Vercel** |
| 資料庫 / 登入 / 即時 | **Supabase**（Postgres + Auth + Realtime + Row Level Security） |
| 播放 | YouTube IFrame Player API |
| KTV 歌詞 | LRCLIB（免費、免金鑰；英文覆蓋佳，華語有限） |

**設計重點**：讀取與即時同步走 anon key + RLS；有商業邏輯的寫入（點歌、插播、跳過、管理）一律經 Next.js Route Handlers 用 service-role 金鑰在後端驗證，前端不直接寫入。即時推播取代輪詢，點歌幾乎即時出現。

---

## 主要頁面

| 路徑 | 說明 | 登入 |
|---|---|---|
| `/` | 首頁（註冊／登入入口） | 否 |
| `/signup` → `/onboarding` | 店家註冊、建立店家 | 是 |
| `/dashboard` | 店家後台：播放器/客人連結、各桌 QR（可下載/列印） | 是 |
| `/player` | 平板播放器（自動對應登入者的店） | 是 |
| `/v/[venueId]?table=桌號` | 客人點歌頁（QR 連到這裡） | 否 |
| `/api/*` | search / request-song / paid-bump / vote-skip / lyrics / venue / admin | — |

**播放器三種模式**（播放器上方切換，存於店家設定）：
- 🎵 **播歌**：只顯示旋轉黑膠，當背景音樂
- 📺 **MV**：播影片、裁掉 YouTube 介面
- 🎤 **KTV**：疊上同步歌詞跟唱（LRCLIB；找不到時提示改用 MV）

---

## 專案結構

```
jukebox-app/              Next.js 應用
  src/app/                頁面與 API 路由
  src/components/         共用元件（CustomerView…）
  src/lib/                supabase client、useVenue、i18n、lyrics、types
  supabase/
    schema.sql            主 schema（資料表 + RLS + Realtime + seed）
    02-skip-votes.sql     跳過投票
    03-history-curation.sql  歷史歌單拖曳排序/刪除
  SETUP.md                詳細設定步驟
make_qrcodes_app.py       產生各桌 QR（指向 /v/[venueId]?table=）
```

---

## 初次設定

詳見 [`jukebox-app/SETUP.md`](jukebox-app/SETUP.md)，重點：

1. **Supabase**：建專案 → SQL Editor 依序執行 `supabase/schema.sql`、`02-skip-votes.sql`、`03-history-curation.sql`。
2. **登入帳號**：Authentication ▸ Users 建立店家 email/密碼；解開 `schema.sql` 底部 seed 區塊建立第一家店、取得 `venue_id`。
3. **環境變數**（`jukebox-app/.env.local`，正式環境設在 Vercel）：
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=      # 祕密，勿外流
   YOUTUBE_API_KEY=                # 祕密，勿外流
   NEXT_PUBLIC_DEFAULT_VENUE_ID=
   ```
4. **Vercel**：Import 此 repo，**Root Directory 設為 `jukebox-app`**，填入上述環境變數，Deploy。之後 push 到 `main` 自動部署。

## 本機開發

```bash
cd jukebox-app
npm install
npm run dev        # http://localhost:3000
```

---

## 已知限制

- **YouTube 搜尋配額**：每把金鑰每天約 100 次搜尋（搜尋 1 次=100 單位）。多店共用會不夠，未來規劃讓每店自帶金鑰；客人改用「貼連結」不耗配額。
- **華語 KTV 歌詞**：LRCLIB 對中文歌覆蓋有限，找不到會提示改用 MV 模式。要全覆蓋需自架歌詞代理或改用授權 API。
- **音樂授權**：在營業場所以 YouTube 播放／顯示歌詞涉公開演出與版權，商用前請自行確認授權合規。
