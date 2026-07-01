# CineScrape 電影爬蟲與 AI 推薦系統

這是一個整合網路爬蟲與前端 SPA (Single Page Application) 的夏日海灘風格電影探索專案。專案結合了自動化數據擷取與現代化的 AI 對話推薦技術。

## 專案特色

1. **自動化爬蟲**：
   - 使用 `crawl_movies.py` 爬取目標網站的 100 部精選電影。
   - `json_to_csv.py` 處理編碼，將 JSON 轉換為支援 Windows Excel 雙擊開啟無亂碼的 CSV 檔案。

2. **前端探索介面**：
   - 無需伺服器，全純前端 (HTML/CSS/JS) 即可運行。
   - 支援依地區、類型、名稱關鍵字的即時搜尋與多重過濾。
   - 設計感十足的夏日海灘主題 UI（玻璃擬態、滑順過渡動畫）。

3. **CineScrape AI 助手**：
   - **多 API 支援**：內建 OpenAI、Gemini 與 OpenCode 相容端點支援。
   - **UI 彈性設定**：支援在前端面板輸入金鑰與設定端點，並安全地儲存在本地 localStorage 中。
   - **測試連線功能**：設定金鑰後，可一鍵測試連線狀態。
   - **本地特徵配對模式 (無 API 時)**：當不啟用 API 時，系統會針對使用者的輸入進行「中/外文名稱」、「地區」、「類型」的關鍵字擷取，若符合特徵則推薦該電影；若無法配對，則會引導使用者輸入特徵或設定 API。
   - **防護機制**：當使用者連續輸入錯誤/無關字詞達 3 次時，聊天室將自動鎖定 15 秒。

## 如何使用

1. **獲取資料**：
   ```bash
   python crawl_movies.py
   python json_to_csv.py
   ```
2. **開啟網頁 (HTML 純前端版)**：
   直接使用瀏覽器開啟 `index.html`，或使用本地伺服器：
   ```bash
   python -m http.server 8000
   ```
3. **開啟網頁 (Streamlit 測試版)**：
   我們額外提供了一個基於 Python Streamlit 框架的版本，您可以在終端機輸入：
   ```bash
   pip install streamlit requests
   streamlit run streamlit_app.py
   ```
   即可開啟具有相同 UI 邏輯、多 API 支援與本地配對機制的 Streamlit 測試網站。

4. **設定 AI 助手**：
   點擊右下角聊天氣泡 -> 點擊齒輪 ⚙️ 圖示 -> 勾選「啟用 API」並輸入您的 API Key -> 點擊「測試連線並儲存」。
