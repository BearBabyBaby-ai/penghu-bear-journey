# CLAUDE.md · 熊熊澎湖之旅

接手前依序讀完：`START_HERE.txt` → `HANDOFF_CLAUDE_GEMINI.md` → `README.md` → `DEVELOPMENT.md`。延續現有成品，不重新設計。新需求以使用者最新指示為準；只做被要求的改動，不順手改其他行為。

## 絕對限制

- **熊寶**：`dist/assets/bearbao.png` 逐位元保留（SHA-256 `2791856bcf16fd1fc39c67f7ec467659d15cb5790d598c3fb0c1b61d2d0556c7`）。不改繪、不鏡像、不換成其他熊或吉祥物；船程只疊加 `index.html` 內的獨立 SVG 船體。
- **地點座標**：`dist/data.json` 的 `lat`／`lng` 是原表值，不平移、不吸附到陸地或道路。缺座標保留 `null`。地點 `id`（如 `food-11`）不可重新編號，否則既有集章失效。
- **照片**：只能依「同工作表＋同列號」掛回地點。沒有照片就保留空陣列，不拿別處照片替補；`food-551` 的 Maps 連結不是圖片。
- **資料來源**：只用已授權的五個工作表（景點、美食清單、廟宇、奎壁山摩西分海、澎湖縣-未來30天潮汐預報），不讀其他工作表、不修改原表。介面不得恢復試算表來源／工作表清單。
- **移動**：禁止瞬移。自動前往與搖桿都只沿 `dist/geo/penghu-roads-20211217.json` 收錄道路；未知路段視為不可走，無路就停在原地。離島只走「馬公南海交通船碼頭 ⇄ 望安潭門港 ⇄ 七美南滬港」，航行中改道或取消都要到下一港下船後才生效。
- **必須保留**：底部類別下拉（預設景點）、密集數字群組、沿道路導航、港口對港口搭船、探索圖鑑、集章手帳（含匯出／匯入）、潮汐與分海工具。
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

## 手機版面（第13版起）

700px 以下由 `style.css` 末段「2026-10-16 手機版面整理」區塊控制，`dist/mobile-layout.js` 量測下方卡片高度寫入 `--ui-bottom`，讓搖桿與 E 鍵浮在卡片上方。調整手機版面時改這兩處，不要動桌機規則。
