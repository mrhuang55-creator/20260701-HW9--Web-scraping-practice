# 電影網頁與爬蟲開發日記與探查紀錄 (Research Notes)

本文件詳細記錄了 Scrape Center SSR1 電影爬蟲開發、SSL 憑證問題排查與網頁美學設計的全部過程。

---

## 步驟一：分析 HTML 卡片結構（以「霸王別姬」為例）
*   **卡片主容器**：`<div class="el-card item ...">`
*   **電影名稱**：`<a class="name"><h2 class="m-b-sm">...</h2></a>`
*   **各類別定位**：
    *   類別標籤包含在 `<div class="categories">` 下的 `<button class="category"><span>...</span></button>` 結構中。
    *   提取代碼：`[btn.get_text(strip=True) for btn in card.select('.categories button span')]`
*   **地區、片長與日期**：
    *   均存放在 `<div class="info">` 標籤中。
    *   第一個 info 區塊含有地區（第 1 個 `span`）與片長（第 3 個 `span`，跳過中間斜線）。
    *   第二個 info 區塊含有上映日期。
*   **星等與分數**：
    *   評分文字存放在 `<p class="score">` 中。
    *   星等值存放於 `<div class="el-rate">` 的 `aria-valuenow` 屬性中，用以表示實質的 5 星百分比。

---

## 步驟二：解決 SSL 憑證過期問題
*   **問題描述**：首次執行 `crawl_movies.py` 時，程式拋出連線安全錯誤：
    `SSLError(SSLCertVerificationError(1, '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: certificate has expired'))`
    這是由於 Scrape Center 測試網站的 HTTPS 憑證已過期。
*   **解決對策**：
    1. 在 `requests.get(..., verify=False)` 中停用憑證安全驗證，強行建立 HTTP 連線。
    2. 使用 `urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)` 停用終端機鋪天蓋地的不安全連線警告，使輸出日誌保持清秀可讀。

---

## 步驟三：海報封面 Fallback 機制設計
*   **挑戰**：如果使用者未下載海報的資源夾（`Scrape _ Movie_files`），或網頁被發布到其他伺服器，本地相對路徑的海報將會破圖。
*   **設計歷程**：
    1. 爬蟲階段：在爬取時抓取 `img.cover` 的原始 `src` 欄位並存入 JSON。
    2. 前端渲染階級：在 `app.js` 中，為 `<img>` 綁定 `onerror` 處理程序。
    3. `onerror` 行為：一旦本地圖檔加載失敗，自動提取檔名並將 `src` 改指向美團的線上 CDN 快取 (`https://p0.meituan.net/movie/{filename}`)。若依然失敗，則顯示一張來自 Unsplash 的高畫質精緻沙灘預設圖。
    4. 結果：測試證明此機制極大增強了網頁在各種部署環境下的強健度。

---

## 步驟四：設計風格大改版 (夏日海灘風格)
*   **需求變更**：將原本冰冷的「暗黑電影院風」大改版為溫暖清爽的「夏日海邊風」。
*   **調色盤重構**：
    *   背景由純黑改為暖沙金黃、澄黃陽光與海浪蔚藍的三色徑向混色，營造陽光沙灘氛圍。
    *   卡片與控制面板改為帶有輕透感的海玻璃白透明色調，提升質感。
    *   Logo 圖示改為棕櫚椰子樹 (🌴)，並為其加上微幅的左右擺動動畫 (Wave Animation)，讓網站更具動態生命力。

---

## 步驟五：Excel 中文相容性優化
*   **問題**：在將抓取結果輸出為 CSV 時，Windows 的 Microsoft Excel 預設無法正確識別 UTF-8 編碼中的中文字，導致直接點選開啟會出現大面積亂碼。
*   **解決對策**：在 `json_to_csv.py` 寫入 CSV 檔案時，改用 **`utf-8-sig`**（即包含 BOM 標籤的 UTF-8）編碼。BOM 會明確告知 Excel 這是一個 UTF-8 檔案，從而實現雙擊無痛開啟。

---

## 步驟六：升級 CineScrape AI 助手與防護機制
*   **需求變更**：移除原有的 60 天失效機制，改為提供更具彈性的 API 設定面板，允許使用者自行輸入並切換多種 API 提供商。當無 API 時提供本地特徵配對。
*   **實作設計**：
    1. **多重 API 提供商 (OpenAI/Gemini/OpenCode)**：
       利用前端介面提供 API 金鑰及端點輸入，並將設定透過 `localStorage` 保存，確保使用者的金鑰不會外洩於原始碼 (`config.js` 已被清空作為安全考量)。
    2. **無 API 本地特徵配對 (Local Fallback)**：
       解析電影名稱字串（拆解中文與外文名稱）。若使用者未啟用 API，但輸入的內容擊中了電影的特徵（中外文名稱、地區、類型），則觸發本地程式碼的自動推薦邏輯。
    3. **錯誤防護機制 (Lockout)**：
       建立防護懲罰機制。若發生 API 連線錯誤，或在無 API 模式下使用者連續 3 次輸入與特徵無關的字詞，聊天輸入框將被強制鎖定 15 秒，並呈現倒數狀態。
    4. **解除原有限制 (Guardrails Lifted)**：
       一旦 API 成功連接，System Prompt 將不再限制只能討論這 100 部電影。AI 會保留夏日海灘的語氣，但能夠回答用戶的任意提問。

---

## 步驟七：新增 Python Streamlit 原生測試版本與死結修復
*   **需求描述**：提供一個基於 Python `streamlit` 框架的版本 (`streamlit_app.py`)，讓開發者可以在沒有網頁伺服器的情況下，直接以 Python 語言原生測試相同的篩選、API 設置與對話邏輯。
*   **技術挑戰與修復 (Deadlock Fix)**：
    1. **狀態管理**：Streamlit 沒有前端 JS 的 `setInterval`，所有狀態皆透過 `st.session_state` 管理。
    2. **死結問題**：原本設計中，當 AI 錯誤達 3 次鎖定介面時，因為隱藏了 `st.chat_input`，使用者無法觸發 Streamlit 的重新整理 (`rerun`)，導致 15 秒後畫面依舊卡在「鎖定中」。
    3. **解決對策**：利用 `st.empty()` 佔位符配合 `time.sleep(1)`，在鎖定期間故意**阻塞 (block)** 執行緒，透過 `while` 迴圈每秒更新一次畫面上的倒數提示，直到歸零後再呼叫 `st.rerun()` 重繪介面並恢復輸入框，成功化解死結。

---

## 步驟八：資料自動繁體化與特定字詞校正
*   **需求描述**：目標網站 (Scrape Center) 的資料預設為簡體中文，且部分地區欄位包含如「中国台湾」等字眼。使用者要求將所有抓取下來的資料全自動轉為繁體，並針對四種連詞變體（中國臺灣、中國台灣、中国臺灣、中国台湾）統一修正為「臺灣」。
*   **實作設計**：
    1. **引入 OpenCC 套件**：使用 Python 的 `opencc-python-reimplemented` 套件進行精準的簡繁轉換（採用 `s2twp` 臺灣正體標準）。
    2. **爬蟲管線升級 (Pipeline Upgrade)**：在 `crawl_movies.py` 寫出 `movies_results.json` 之前，加入了遞迴轉換邏輯 (`traverse` function)。
    3. **自訂替換鏈**：在 OpenCC 轉換後，套用鏈式替換 `.replace('中國臺灣', '臺灣').replace('中國台灣', '臺灣').replace('中国臺灣', '臺灣').replace('中国台湾', '臺灣').replace('台灣', '臺灣')`，確保任何形式的誤植都能被修正。
    4. **向下相容**：加入 `try-except ImportError` 防止未來執行環境未安裝 `opencc` 時發生崩潰，並會在終端機給出警告。

---

## 步驟九：介面拖曳化、API 端點修正與 CSS 標準化
*   **需求描述**：
    1. 使用者希望網頁版 (`index.html`) 的 AI 助手介面能夠彈性拖曳，不遮擋主要內容。
    2. Gemini API 出現 404 連線錯誤，需要修正端點。
    3. CSS 檔案中出現非標準前綴 (`-webkit-background-clip`、`-webkit-line-clamp`) 警告。
*   **實作設計與修復**：
    1. **可拖曳浮動視窗 (Draggable UI)**：在 `app.js` 中實作 `mousedown`, `mousemove`, `mouseup` 事件，綁定於聊天視窗標題列 (`.chat-header`)。拖曳時動態計算滑鼠與視窗座標差 (Offset)，並將 CSS `right/bottom` 佈局轉為 `left/top` 絕對定位，達成平滑無延遲的拖曳體驗。
    2. **API 端點對齊官方標準**：捨棄舊版 `v1beta`，將 `app.js` 及 `streamlit_app.py` 的請求 URL 全面升級為 Google 最新標準 `v1/models/gemini-1.5-flash`，徹底解決 404 找不到模型的錯誤。
    3. **CSS 現代化標準修正**：在 `style.css` 中，為使用 `-webkit` 專屬前綴的屬性，額外補上標準語法 (`background-clip: text;`、`line-clamp: 2;`)，不僅消除編輯器警告，也確保在未來各家現代瀏覽器上的完美相容性。
