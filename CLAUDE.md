# CLAUDE.md · 熊熊澎湖之旅

接手前依序讀完：`START_HERE.txt` → `HANDOFF_CLAUDE_GEMINI.md` → `README.md` → `DEVELOPMENT.md`。延續現有成品，不重新設計。新需求以使用者最新指示為準；只做被要求的改動，不順手改其他行為。

## 絕對限制

- **熊寶**：`dist/assets/bearbao.png` 逐位元保留（SHA-256 `2791856bcf16fd1fc39c67f7ec467659d15cb5790d598c3fb0c1b61d2d0556c7`）。不改繪、不鏡像、不換成其他熊或吉祥物。2026-10-16 起依使用者指定：海上搭船顯示「搭船熊寶」`dist/assets/bear-boat.webp`、陸上移動中顯示「騎車熊寶」`dist/assets/bear-ride.webp`，停下來與剛上岸（港區上下船）顯示原始熊寶；兩張新圖原檔在 `sources/characters/`，只能用 `tools/build-character-sprites.py` 縮放，不改繪、不鏡像。`index.html` 的 SVG 船體 `#ferry-boat` 保留但不再顯示。
- **地點座標**：`dist/data.json` 的 `lat`／`lng` 是原表值，不平移、不吸附到陸地或道路。缺座標保留 `null`。地點 `id`（如 `food-11`）不可重新編號，否則既有集章失效。
- **照片**：只能依「同工作表＋同列號」掛回地點。沒有照片就保留空陣列，不拿別處照片替補；`food-551` 的 Maps 連結不是圖片。
- **資料來源**：只用已授權的五個工作表（景點、美食清單、廟宇、奎壁山摩西分海、澎湖縣-未來30天潮汐預報），不讀其他工作表、不修改原表。介面不得恢復試算表來源／工作表清單。另有使用者指定的「交通船資訊」工作表（2026-10-16 建立），遊戲的「交通船」面板即時讀取它（`dist/ferry-sheet.js`，公開 CSV、無 API 金鑰；讀不到時用內建檔）。港口位置與海路仍只來自 `dist/geo/penghu-ferries-20261016.json`，工作表新增的航線在海路建好前只顯示、不能搭乘。每週排程任務「熊熊澎湖之旅 交通船週檢」會查核官方資料並同步兩邊。
- **移動**：禁止瞬移。自動前往與搖桿都只沿 `dist/geo/penghu-roads-20211217.json` 收錄道路；未知路段視為不可走，無路就停在原地。離島只走已收錄航線：「馬公南海交通船碼頭 ⇄ 望安潭門港 ⇄ 七美南滬港」與白沙鄉公所交通船「赤崁漁港 ⇄ 吉貝漁港」「岐頭漁港 ⇄ 鳥嶼漁港」「岐頭漁港 ⇄ 員貝漁港」「重光碼頭 ⇄ 大倉漁港」與馬公市公所交通船「馬公南海交通船碼頭 ⇄ 桶盤漁港」「馬公南海交通船碼頭 ⇄ 虎井漁港」（`dist/geo/penghu-ferries-20261016.json`），新增航線須先以官方資料確認港口與連通；航行中改道或取消都要到下一港下船後才生效。
- **必須保留**：底部類別下拉（預設景點）、密集數字群組、沿道路導航、港口對港口搭船、探索圖鑑、集章手帳（含匯出／匯入）、交通船資訊面板、潮汐與分海工具。
- **不得恢復**：島嶼任務、任務門檻、戰鬥、NPC 吉祥物家族。
- **路徑**：所有資源用相對路徑（GitHub Pages 子目錄相容），不改成 `/assets/...`。不引入外部 CDN（`tests/verify.mjs` 會檢查）。
- **存檔**：鍵 `bear-penghu-3d-v1`，保留 `version`、`stamps`、`observed`、`area`、`position`、`journey` 格式。

## 每次修改後

1. 根目錄執行 `npm run check`（應使用 Node.js 24；六組測試都須 PASS）。
2. 改到畫面時，用 HTTP 伺服器開 `dist/`，實際檢查桌機（約 1366×800）與手機（約 393×760、360×640）。
3. 同步更新 `HANDOFF_CLAUDE_GEMINI.md`、`README.md`、`DEVELOPMENT.md`、`START_HERE.txt` 與 `EXPORT-MANIFEST.json`；`index.html` 內 `?v=` 版本參數一併更新。
4. 沒做過的檢查（例如實機、GitHub Actions、外部圖磚連線）要寫明「未驗證」，不可宣稱通過。

## App 設定（第14版起）

`dist/manifest.json`、`dist/sw.js`、`dist/pwa.js`、`dist/icons/`。更換圖示或 manifest 時改 `sw.js` 的 `VERSION`。App／APK 圖示來源是使用者指定的 `sources/app-icon-travel-bear.png`（旅遊熊熊.png），只能用 `tools/build-app-icons.py` 縮放產生，不改繪；遊戲內角色仍是 `bearbao.png`，兩者不可互換。換圖示後 APK 需用 PWABuilder 重新打包。正式網址：https://bearbabybaby-ai.github.io/penghu-bear-journey/

## Android APK

Package ID `io.github.bearbabybaby_ai.penghubear`，與熊熊綜合系統共用簽章金鑰（金鑰不在本儲存庫）。網域根 `assetlinks.json` 在 `BearBabyBaby-ai.github.io` 儲存庫，兩個App各一筆，修改時不可刪掉另一筆。

## 問熊寶

`dist/ask.js` 為本機文字查詢，不得改成連外部 AI／API（使用者明確要求不串 API）。結果只能來自 `data.json` 原表地點；「前往」只能走 `navigateTo()`（沿道路／港口搭船，禁止瞬移）。

## 手機版面（第13版起）

700px 以下由 `style.css` 末段「2026-10-16 手機版面整理」區塊控制，`dist/mobile-layout.js` 量測下方卡片高度寫入 `--ui-bottom`，讓搖桿與 E 鍵浮在卡片上方。調整手機版面時改這兩處，不要動桌機規則。
