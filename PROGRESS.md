# 餐廳點歌系統 — 開發進度

## 2026-06-22（Day 1：MVP 上線）
- 初始架構：Google Apps Script 後端 + Google Sheets 資料庫
- `customer.html`（客人掃 QR Code 點歌）+ `player.html`（平板播放頁）
- 串接已部署的 Apps Script Web App
- 修復 YT iframe 播放問題（隱藏在黑膠唱片後、自動跳過無法播放的影片）
- 前端大改版：深色串流風格（紫/洋紅配色）

## 2026-06-23（Day 2：功能擴充 + UX 優化）
- 換成 ember 設計風格
- 修復歌名含撇號時按鈕壞掉的問題
- 新增**每桌冷卻時間**（客人端倒數顯示）
- 新增**音樂分類搜尋**
- 播放端設定面板（冷卻/上限/從歷史播放）
- 冷卻邏輯改為達到桌限才開始倒數
- 播放端顯示歷史播放清單

## 2026-06-25（Day 3：大量功能 + 安全性強化）
- **效能優化**：單次來回 addSong（回傳佇列+狀態）、樂觀 UI
- History sheet 拆分，播放端即時跳下一首（減少歌曲間空檔）
- **安全性**：admin token 控制操作、LockService 寫入鎖定、有界歷史讀取
- **內容管理**：營業時間/歌曲長度/黑名單設定 UI
- **統計面板** + 正在播放橫幅 + 重複歌曲防護
- **置頂播放**（play next）功能
- **PWA**：manifests + icons + 加到主畫面 meta
- **投票跳過**：客人投票跳歌，達門檻自動跳過（可在設定調整）
- **多語系**：客人頁 中/EN/日 語言切換
- 清除歷史 + 歌手搜尋模式
- Production hardening（前後端）
- 歷史播放改為順序播放 + 播放端可策展歷史清單
- **付費插播**功能

## 2026-06-27（Day 4：SaaS 升級 — Next.js + Supabase）
- 架構遷移：從 Google Apps Script → **Next.js + Supabase**
- Phase 1：即時客人頁 + 認證播放頁（Supabase realtime）
- 套用 ember 主題到新版
- 移植功能：投票跳過、歷史策展、PWA、多語系
- QR Code 產生器（for 部署後的網址）
- **Phase 2：多租戶**（註冊、儀表板、venue-by-URL）
- 合併歌曲/歌手搜尋為單一搜尋框
- 設定面板 UI 微調

---

## 架構演變

| 版本 | 後端 | 資料庫 | 狀態 |
|------|------|--------|------|
| V1 (06-22~25) | Google Apps Script | Google Sheets | 完成，可用 |
| V2 (06-27~) | Next.js + Supabase | Supabase (PostgreSQL) | Phase 2 完成，多租戶 SaaS |

## 目前功能清單
- QR Code 掃碼點歌（每桌獨立）
- YouTube 搜尋 + 直接貼連結
- 歌曲/歌手搜尋
- 即時佇列 + 自動播放
- 每桌冷卻 + 點歌上限
- 投票跳過 / 付費插播
- 黑名單 / 營業時間 / 歌曲長度限制
- 統計面板 + 歷史記錄
- PWA（可加到主畫面）
- 中/EN/日 三語
- 多租戶 SaaS（Phase 2）
