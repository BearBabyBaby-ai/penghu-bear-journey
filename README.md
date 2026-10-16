# 熊熊澎湖之旅 · GitHub 專案

可直接部署到 GitHub Pages 的靜態 3D 遊戲。無須資料庫、API 金鑰或前端建置。

此版本保留熊寶原圖、道路移動、608筆美食、景點與廟宇、探索圖鑑、集章手帳、潮汐與分海工具；已刪除島嶼任務及介面的試算表資料來源／工作表清單。

新增「問熊寶」（2026-10-16）：上方文字框輸入「想去玄天上帝廟」「想去七美」「附近的廟」等，列出原表地點，點「前往」沿道路或搭船出發。純本機比對，不連 AI 或任何 API。

第14版（2026-10-16）：加入 App 設定（`manifest.json`、`sw.js`、`pwa.js`、`icons/`），可安裝到手機桌面，也可用 PWABuilder 打包成 Android APK（做法同熊熊綜合系統）。GitHub 儲存庫：`BearBabyBaby-ai/penghu-bear-journey`，網址 https://bearbabybaby-ai.github.io/penghu-bear-journey/ 。

第13版（2026-10-16）：手機版面整理。地圖工具改為一列膠囊按鈕，目的地卡改為全寬精簡卡，搖桿與 E 鍵浮在卡片上方不被遮住，新增兩指縮放；桌機版面不變。

第12版：底部改為景點／美食／廟宇／全部下拉選單，預設景點，密集標記合併為可點開的數字群組。切換鄉市從熊寶當下位置導航，禁止瞬移；前往望安／七美先沿路到港，港口對港口搭船，再沿道路到地點。原熊寶PNG保留，船程僅疊加獨立船體。

## 上傳與部署

1. 解壓縮 ZIP，將 `bear-penghu-github` 資料夾內的內容放在 GitHub 儲存庫根目錄。必須包含 `.github/workflows/deploy-pages.yml`；不要只上傳 ZIP 或多包一層資料夾。
2. 使用 `main` 分支提交所有檔案。
3. 開啟儲存庫 **Settings → Pages → Build and deployment → Source**，選擇 **GitHub Actions**。
4. 開啟 **Actions → Deploy Penghu Game to GitHub Pages → Run workflow**，選擇 `main` 執行。之後每次更新 `main` 都會自動檢查並部署。
5. 工作流程完成後，在 **Settings → Pages** 或成功部署的工作流程中開啟遊戲網址。

部署設定已指定發布 `dist/`，根網域與儲存庫子路徑皆使用相對路徑。若儲存庫使用其他分支名稱，請同步修改工作流程中的 `branches`。

若使用「Deploy from a branch」方式，也可選擇 `main` 的根目錄 `/`；根目錄 `index.html` 會導向 `dist/`。建議使用已附的 GitHub Actions，以便發布前自動檢查資料與道路。

GitHub Pages 的儲存庫與帳號須具備 Pages 使用資格；無法看到 Pages 設定時，請依 GitHub 的方案與組織設定確認。

## 本機檢查

建議使用 Node.js 24。在專案根目錄執行：

```sh
npm run check
```

本專案沒有 npm 套件依賴，不需要執行 `npm install`。檢查包含原始熊寶圖檔、977 筆紀錄、陸海判斷、道路轉彎、940 個地標與群組、12組跨區往返、港口搭船、改道／取消／旅程恢復、實際鄉市與類別事件處理器，以及潮汐／印章存檔。

如果電腦已安裝 Python 3，可用 HTTP 開啟本機版本：

```sh
python -m http.server 4173 --directory dist
```

再開啟 `http://localhost:4173/`。Windows 若使用 Python Launcher，可將 `python` 換成 `py`。請透過 HTTP 或 HTTPS 使用遊戲，直接雙擊 HTML 的 `file://` 方式無法正常讀取模組與 JSON。

## Claude／Gemini接手

先把 `HANDOFF_CLAUDE_GEMINI.md` 給接手模型閱讀，再提供完整解壓縮專案。程式、JSON資料、141張網頁照片、測試及來源對應都在專案內，不依賴本次聊天上下文。接手模型可直接閱讀並修改，不需原Sites帳號。

白沙起點已改為白沙本島的澎湖水族館附近；原圖依原表列號逐一對應，禁止拿其他地點照片替補。照片在目的地卡、圖鑑與地點詳情顯示。

## 港口與連續導航

馬公與西嶼等本島區域沿道路及已收錄橋梁移動；離島採馬公南海交通船碼頭 ⇄ 望安潭門港 ⇄ 七美南滬港，以及白沙鄉公所交通船赤崁漁港 ⇄ 吉貝漁港、岐頭漁港 ⇄ 鳥嶼漁港、岐頭漁港 ⇄ 員貝漁港、重光碼頭 ⇄ 大倉漁港；會自動選最近的港口，必要時下船後沿路走到另一個港口再搭船。船程顯示熊寶搭船，海路採藍色虛線。航行中變更目的地會在下一港口下船後改道，取消也會先靠港下船。其他未收錄航線不瞬移；港區接駁與海路均為遊戲示意，並非實測航道或即時船班。

旅程會保存當前進度；分海動畫另有示意場景，返回會保留原位。程式分工與來源見DEVELOPMENT.md及HANDOFF_CLAUDE_GEMINI.md。

## App（APK）

做法與熊熊綜合系統相同：GitHub Pages 網站 ＋ App 設定，再用 PWABuilder 打包成 Android APK（Trusted Web Activity）。

- `sw.js`：畫面、程式與 JSON 先連網取最新版，沒網路才用上次的版本；相片與圖示存在手機。GitHub 更新後，App 下次開啟就是新版，不必重新安裝 APK。只有更換圖示或 `manifest.json` 時，才需要改 `sw.js` 的 `VERSION`。
- APK 要全螢幕（不顯示網址列）開啟，網域根目錄 `https://bearbabybaby-ai.github.io/.well-known/assetlinks.json`（放在 `BearBabyBaby-ai.github.io` 儲存庫）必須加入此 App 的 package 名稱與簽章指紋。少了這筆，APK 仍可用，但上方會出現網址列。
- App／APK 圖示來源為 `sources/app-icon-travel-bear.png`（使用者指定的「旅遊熊熊.png」），由 `python tools/build-app-icons.py` 只做縮放產生；遮罩圖示另縮小置中於同色藍底。遊戲內角色仍是 `dist/assets/bearbao.png`，不受影響。

## Android APK（2026-10-16 已打包）

- PWABuilder 打包（Trusted Web Activity），Package ID：`io.github.bearbabybaby_ai.penghubear`，Display mode：Standalone。
- 簽章沿用熊熊綜合系統同一把金鑰（SHA-256 指紋 `B4:D3:2D:70:…:04:3A:3A`）；金鑰檔與資訊存於使用者雲端硬碟「key」資料夾，不放進此公開儲存庫。重新打包時選 Use mine、Package ID 不變，才能覆蓋安裝。
- 網域根驗證檔 `https://bearbabybaby-ai.github.io/.well-known/assetlinks.json`（`BearBabyBaby-ai.github.io` 儲存庫）已同時列出熊熊綜合系統（`io.github.bearbabybaby_ai.twa`）與本App兩筆，不可覆蓋其中一筆。
- 若App開啟仍有網址列：清除該App儲存空間或重新安裝，讓手機重新驗證。
- 未驗證：實體手機上的全螢幕顯示結果、各Android版本相容性。

## 進度轉移

集章進度儲存在各網站的瀏覽器儲存空間。搬到 GitHub Pages 後，請先在舊網站的「集章手帳」匯出進度備份，再於新網站匯入。程式與資料檔案備份不包含瀏覽器內的個人進度。

## 內容與更新位置

| 路徑 | 用途 |
| --- | --- |
| `dist/index.html` | 遊戲畫面及工具入口 |
| `dist/style.css` | 電腦與手機版面 |
| `dist/mobile-layout.js` | 手機搖桿／E鍵避開下方卡片 |
| `dist/ask.js` | 問熊寶本機文字查詢 |
| `CLAUDE.md` | 接手模型必讀的核心限制 |
| `dist/manifest.json`、`dist/sw.js`、`dist/pwa.js` | App 安裝設定與離線快取 |
| `dist/icons/` | App 圖示，由 `sources/app-icon-travel-bear.png`（旅遊熊熊）產生（`tools/build-app-icons.py`） |
| `dist/game.js` | 操作、圖鑑、集章及潮汐工具 |
| `dist/engine.js` | WebGL 3D 繪製 |
| `dist/places.js` | 全部地標與類別顯示 |
| `dist/roads.js` | 沿道路尋路與移動 |
| `dist/media.js` | 本地原表照片顯示 |
| `dist/assets/places/` | 141張網頁照片與原圖對應清單 |
| `sources/` | 美食／圖資欄原始快照與照片資產對應 |
| `HANDOFF_CLAUDE_GEMINI.md` | Claude／Gemini接手完整說明 |
| `dist/assets/bearbao.png` | 原始透明熊寶圖檔 |
| `dist/data.json` | 景點、廟宇與潮汐快照 |
| `dist/geo/` | 陸域、道路與圖資授權 |
| `tests/` | 資料與程式檢查 |
| `tools/` | 陸域與道路資料重建工具 |
| `DEVELOPMENT.md` | 實作細節、資料版本與檢核範圍 |
| `EXPORT-MANIFEST.json` | 本次匯出資訊及檔案 SHA-256 |

地點與潮汐資料為 2026-10-15 快照，GitHub 版本不會自動重新讀取 Google 試算表。更新資料時請修改 `dist/data.json` 並執行檢查。

977筆地點中，940筆有有效座標；另37筆資料（18美食、19廟宇）保留於圖鑑。道路資料為 OSM 2021-12-17 快照，可能缺少新道路；地標不會因缺道路而從地圖消失。底圖圖磚仍需網路連線。

## 署名與驗證範圍

國土測繪陸域、OSM 道路及第三方工具的授權與出處保留於 `dist/geo/SOURCES.md`、`dist/geo/MIRROR-LICENSE.txt` 及 `tools/vendor/polygon-clipping-LICENSE.md`。此匯出未為熊寶圖像與第一方內容另行指定開源授權。

第13版已執行 `npm run check`（Node.js 22.22.0，六組PASS；Node 24未在此環境實測），並以無頭Chromium截圖檢查桌機與三種手機尺寸。外部底圖圖磚、實體手機操作及你的 GitHub 儲存庫 Actions 尚未驗證。

部署設定依 GitHub 官方文件整理：
https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
