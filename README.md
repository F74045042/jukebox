# 餐廳點歌系統 — 部署說明

## 系統架構
- **`apps_script.gs`**：後端，部署在 Google Apps Script，資料存在 Google Sheets
- **`customer.html`**：客人手機點歌頁，掃桌上 QR Code 進入
- **`player.html`**：平板播放頁，接藍芽喇叭播放音樂

---

## 步驟 1：建立後端

1. 到 [Google Sheets](https://sheets.google.com) 開一個新的空白表格，取名「點歌系統」
2. 上方選單 **擴充功能 > Apps Script**
3. 把 `apps_script.gs` 的內容整段貼進去，蓋掉原本的 `myFunction`
4. 申請 YouTube Data API 金鑰：
   - 到 [Google Cloud Console](https://console.cloud.google.com/)
   - 建立新專案 → 啟用「**YouTube Data API v3**」
   - 憑證 > 建立憑證 > API 金鑰
   - 把金鑰貼到 `apps_script.gs` 第 14 行的 `YOUTUBE_API_KEY`
5. 點上方「部署 > 新增部署」
   - 類型：**網頁應用程式**
   - 執行身分：**我**
   - 存取權限：**任何人**
6. 部署後會拿到一個網址，結尾是 `.../exec`，**這個網址要貼到 customer.html 和 player.html 裡**

> ⚠️ 之後如果改了程式碼，要記得「管理部署 > 編輯 > 部署」才會更新線上版本。

---

## 步驟 2：設定前端網址

打開 `customer.html` 和 `player.html`，把這一行：
```js
const API_URL = 'PUT_YOUR_APPS_SCRIPT_URL_HERE';
```
換成步驟 1 拿到的 `.../exec` 網址。

---

## 步驟 3：放到網路上

兩個 HTML 檔案需要放到一個網址上才能用手機/平板開啟，最簡單的方式：

- **GitHub Pages**（免費）：建一個 repo，把兩個 html 丟進去，設定 Pages 即可
- **Netlify / Vercel**（免費）：把資料夾拖進去就會自動產生網址
- 或你原有的網站空間，直接把檔案上傳

假設部署後網址是 `https://你的網域/customer.html`，那麼：
- 每桌的 QR Code 連到：`https://你的網域/customer.html?table=A1`（A1 換成各桌桌號）
- 平板開啟：`https://你的網域/player.html`

---

## 步驟 4：製作每桌的 QR Code

用任何免費 QR Code 產生器（例如 https://www.qr-code-generator.com/）
把每桌專屬的網址（含 `?table=桌號`）轉成 QR Code，印出來貼在桌上即可。

---

## 步驟 5：平板設定

1. 平板瀏覽器開啟 `player.html`
2. 點一下「▶ 開始播放」解鎖音訊（瀏覽器規定要有一次手動點擊才能播放聲音）
3. 接下來會自動播放佇列、播完自動接下一首
4. 平板透過藍芽連接喇叭，跟你現在的用法一樣

---

## 重要限制與調整空間

- **YouTube 搜尋配額**：免費額度約每天 100 次搜尋，用完後客人可改用「貼上 YouTube 連結」（不耗配額）。
  - 如果常常用完，可以到 Google Cloud Console 開通計費，超額部分費用很低（每 1000 次約數十元台幣等級），開通後配額會大幅提升。
  - 開通計費後，把 `apps_script.gs` 裡的 `DAILY_SEARCH_LIMIT` 調大或移除限制即可。
- **每桌點歌數量**：目前設定「同時最多 3 首待播」，可在 `apps_script.gs` 的 `MAX_WAITING_PER_TABLE` 調整。
- **不雅歌曲**：目前沒有自動過濾機制，建議平板螢幕讓店員能隨時看到，搭配「跳過」按鈕手動處理。
- **資料保存**：所有點歌記錄都存在 Google Sheet 的「Queue」分頁裡，可以直接打開查看歷史紀錄（已播放的歌會標記為 `played`，不會被刪除，除非按了清空）。
