# 電影爬蟲 (Scrape Center SSR1) HTML 結構分析報告

本報告針對 `https://ssr1.scrape.center` 的電影列表頁面（以「霸王別姬」卡片為例）進行 HTML 結構與欄位解析。

---

## 1. 欄位提取數值表格 (Extracted Values)

以下為從「霸王別姬」電影卡片中成功提取的各欄位數值對照表：

| 欄位名稱 (Field) | 提取數值 (Extracted Value) | 備註 (Remarks) |
| :--- | :--- | :--- |
| **電影名稱** | `霸王別姬- Farewell My Concubine` | 包含中文及英文名稱 |
| **類別 (Categories)** | `['劇情', '愛情']` | 回傳清單結構 |
| **地區 (Region)** | `中國內地、中國香港` | 拍攝與發行地區 |
| **片長 (Duration)** | `171 分鐘` | 片長資訊 |
| **上映日期 (Release Date)** | `1993-07-26` | 已去除了「 上映」字樣 |
| **評分 (Rating)** | `9.5` | 浮點數評分 |
| **星等價值 (Rating Value)** | `4.75` | 對應星星評分條的實質滿分 5 分比例值 |

---

## 2. HTML 標籤與 CSS 選擇器對照表 (CSS Selectors)

| 欄位名稱 (Field) | HTML 標籤特徵 (HTML Tag) | 推薦 CSS 選擇器 (CSS Selector) |
| :--- | :--- | :--- |
| **卡片主容器** | `<div class="el-card item ...">` | `div.el-card.item` |
| **電影名稱** | `<h2 class="m-b-sm">電影名稱</h2>` | `a.name h2` |
| **類別 (Categories)** | `<button class="category"><span>類別</span></button>` | `div.categories button.category span` |
| **地區 (Region)** | `第一個 class="info" 的第一個 span` | `div.info:nth-of-type(1) span:nth-of-type(1)` |
| **片長 (Duration)** | `第一個 class="info" 的第三個 span` | `div.info:nth-of-type(1) span:nth-of-type(3)` |
| **上映日期 (Release Date)** | `第二個 class="info" 的 span` | `div.info:nth-of-type(2) span` |
| **評分 (Rating)** | `<p class="score">9.5</p>` | `p.score` |
| **星等價值 (Rating Value)** | `<div class="el-rate" aria-valuenow="4.75">` | `div.el-rate` (獲取 `aria-valuenow` 屬性) |

---

## 3. BeautifulSoup 欄位提取程式碼片段 (BS4 Code Snippets)

假設變數 `card` 代表單個電影卡片的 BeautifulSoup 對象（即 `soup.select_one('div.el-card.item')`）：

```python
# 1. 提取電影名稱
name = card.select_one('a.name h2').get_text(strip=True)

# 2. 提取類別 (Categories)
# 由於網頁有經過翻譯/字型混淆，使用 get_text() 可以相容
categories = [btn.get_text(strip=True) for btn in card.select('div.categories button.category span')]

# 3. 提取地區與片長 (Region & Duration)
# 地區與片長存在於同一個 class="info" 的 div 區塊內
info_divs = card.select('.info')
first_info_spans = info_divs[0].select('span')
region = first_info_spans[0].get_text(strip=True)
duration = first_info_spans[2].get_text(strip=True)  # 跳過第2個 span (斜線 "/")

# 4. 提取上映日期 (Release Date)
release_date_raw = info_divs[1].select_one('span').get_text(strip=True)
release_date = release_date_raw.replace(' 上映', '').strip()

# 5. 提取評分 (Rating)
rating = card.select_one('p.score').get_text(strip=True)

# 6. 提取星等價值 (Rating Value)
rate_element = card.select_one('div.el-rate')
rating_value = rate_element.get('aria-valuenow') if rate_element else None
```

---

## 4. 翻頁與全站爬取邏輯說明 (Looping & Scraping Pages 1–10)

若要爬取 `https://ssr1.scrape.center` 的第 1 頁到第 10 頁，完整的執行逻辑如下：

### A. 網址分頁規律分析
觀察分頁 URL 可以發現：
* 第一頁：`https://ssr1.scrape.center/page/1`
* 第二頁：`https://ssr1.scrape.center/page/2`
* 第十頁：`https://ssr1.scrape.center/page/10`
網址結構為：`https://ssr1.scrape.center/page/{page_number}`，其中 `{page_number}` 為 `1` 到 `10` 的整數。

### B. 雙層迴圈設計
為了爬取多個頁面與每個頁面中的所有電影，程式需要採用雙層迴圈：
1. **外層迴圈**：控制頁碼（`1` 到 `10`），拼接 URL 發送請求。
2. **內層迴圈**：解析單頁的 HTML，提取出所有的電影卡片容器（`div.el-card.item`），並逐一清洗、提取欄位資訊。

### C. 範例爬蟲實作代碼 (Python)
此實作同樣加入了**防封鎖延遲**（符合網路禮節），在每次翻頁請求之間暫停 `1` 秒：

```python
import requests
from bs4 import BeautifulSoup
import time
import json

base_url = "https://ssr1.scrape.center/page/{}"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

all_movies = []

for page in range(1, 11):
    url = base_url.format(page)
    print(f"正在爬取第 {page} 頁: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            # 獲取單頁所有電影卡片
            cards = soup.select('div.el-card.item')
            
            for card in cards:
                try:
                    # 1. 電影名稱
                    name = card.select_one('a.name h2').get_text(strip=True)
                    
                    # 2. 類別
                    categories = [btn.get_text(strip=True) for btn in card.select('div.categories button.category span')]
                    
                    # 3. 地區與片長
                    info_divs = card.select('.info')
                    first_info_spans = info_divs[0].select('span')
                    region = first_info_spans[0].get_text(strip=True)
                    duration = first_info_spans[2].get_text(strip=True)
                    
                    # 4. 上映日期
                    release_date_raw = info_divs[1].select_one('span').get_text(strip=True)
                    release_date = release_date_raw.replace(' 上映', '').strip()
                    
                    # 5. 評分
                    rating = card.select_one('p.score').get_text(strip=True)
                    
                    # 6. 星等價值
                    rate_element = card.select_one('div.el-rate')
                    rating_value = rate_element.get('aria-valuenow') if rate_element else None
                    
                    all_movies.append({
                        "名稱": name,
                        "類別": categories,
                        "地區": region,
                        "片長": duration,
                        "上映日期": release_date,
                        "評分": rating,
                        "星等價值": rating_value
                    })
                except Exception as card_err:
                    print(f"解析卡片出錯: {card_err}")
        else:
            print(f"無法存取第 {page} 頁，狀態碼: {response.status_code}")
    except Exception as e:
        print(f"請求第 {page} 頁時發生錯誤: {e}")
        
    # 網路禮節：每次翻頁請求之間暫停 1 秒
    time.sleep(1.0)

# 將爬取結果存成 JSON 檔
with open("movies_results.json", "w", encoding="utf-8") as f:
    json.dump(all_movies, f, ensure_ascii=False, indent=4)

print(f"\n全部爬取完成！已成功儲存 {len(all_movies)} 筆電影資料至 movies_results.json")
```
