import requests
from bs4 import BeautifulSoup
import time
import json
import random
import urllib3
try:
    from opencc import OpenCC
except ImportError:
    OpenCC = None

# 停用 SSL 憑證失效的不安全連線警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def crawl_ssr1_movies():
    base_url = "https://ssr1.scrape.center/page/{}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    all_movies = []
    
    for page in range(1, 11):
        url = base_url.format(page)
        print(f"正在爬取第 {page} 頁: {url}")
        
        try:
            # 發送請求，逾時設為 10 秒，忽略 SSL 憑證驗證
            response = requests.get(url, headers=headers, timeout=10, verify=False)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                cards = soup.select('div.el-card.item')
                
                print(f"  -> 成功讀取！找到 {len(cards)} 部電影。")
                
                for card in cards:
                    try:
                        # 1. 電影名稱
                        name_element = card.select_one('a.name h2')
                        name = name_element.get_text(strip=True) if name_element else "未知電影"
                        
                        # 2. 類別 (Categories)
                        categories = [btn.get_text(strip=True) for btn in card.select('div.categories button.category span')]
                        
                        # 3. 地區與片長 (Region & Duration)
                        info_divs = card.select('.info')
                        region = "未知"
                        duration = "未知"
                        if len(info_divs) > 0:
                            first_info_spans = info_divs[0].select('span')
                            if len(first_info_spans) > 0:
                                region = first_info_spans[0].get_text(strip=True)
                            if len(first_info_spans) > 2:
                                duration = first_info_spans[2].get_text(strip=True)
                        
                        # 4. 上映日期 (Release Date)
                        release_date = "未知"
                        if len(info_divs) > 1:
                            release_date_span = info_divs[1].select_one('span')
                            if release_date_span:
                                release_date = release_date_span.get_text(strip=True).replace(' 上映', '').strip()
                        
                        # 5. 評分 (Rating)
                        rating_element = card.select_one('p.score')
                        rating = rating_element.get_text(strip=True) if rating_element else "無評分"
                        
                        # 6. 星等價值 (Rating Value)
                        rate_element = card.select_one('div.el-rate')
                        rating_value = rate_element.get('aria-valuenow') if rate_element else None
                        if rating_value:
                            rating_value = float(rating_value)
                            
                        # 7. 封面圖片 (Cover Image)
                        cover_element = card.select_one('img.cover')
                        cover = cover_element.get('src') if cover_element else None
                        # 如果是相對路徑，補上基底網址
                        if cover and cover.startswith('.'):
                            # 本地 HTML 會指向相對目錄，我們將其轉回線上真實 URL 以便網頁正常載入
                            # 例如 ./Scrape _ Movie_files/xxx.jpg 轉為線上網址
                            cover_filename = cover.split('/')[-1]
                            # 對應 Scrape Center 的圖片快取，可以直接用線上相對路徑的解析，或者用備用占位圖
                            # 由於 ssr1.scrape.center 的圖片通常是從 meituan 託管，這點我們可以做個對應處理
                            # 若本機有 Scrape _ Movie_files，網頁可以直接讀取它，但如果發布到網路上，使用線上網址更好。
                            # 為了保證本機 index.html 雙擊開啟時能正常讀取，我們先保留原始相對路徑，並提供備份線上路徑！
                            pass
                        
                        all_movies.append({
                            "名稱": name,
                            "類別": categories,
                            "地區": region,
                            "片長": duration,
                            "上映日期": release_date,
                            "評分": rating,
                            "星等價值": rating_value,
                            "封面": cover
                        })
                    except Exception as card_err:
                        print(f"  [警告] 解析電影卡片時出錯: {card_err}")
            else:
                print(f"  [警告] 無法讀取第 {page} 頁，HTTP 狀態碼: {response.status_code}")
                
        except Exception as e:
            print(f"  [錯誤] 請求第 {page} 頁時發生錯誤: {e}")
            
        # 網路禮節：每次翻頁隨機暫停 1 到 2 秒
        if page < 10:
            sleep_time = random.uniform(1.0, 2.0)
            time.sleep(sleep_time)
            
    # 保存為 JSON 檔案
    output_file = "movies_results.json"
    try:
        # 進行繁體中文轉換與臺灣替換
        if OpenCC is not None:
            cc = OpenCC('s2twp')
            def convert_text(text):
                if not isinstance(text, str): return text
                t = cc.convert(text)
                return t.replace('中國臺灣', '臺灣').replace('中國台灣', '臺灣').replace('中国臺灣', '臺灣').replace('中国台湾', '臺灣').replace('台灣', '臺灣')
            def traverse(obj):
                if isinstance(obj, dict): return {convert_text(k): traverse(v) for k, v in obj.items()}
                elif isinstance(obj, list): return [traverse(i) for i in obj]
                elif isinstance(obj, str): return convert_text(obj)
                else: return obj
            all_movies = traverse(all_movies)
            print("已將資料轉換為繁體中文，並替換中國台灣為臺灣。")
        else:
            print("警告: 尚未安裝 opencc-python-reimplemented，跳過繁體轉換。")

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(all_movies, f, ensure_ascii=False, indent=4)
        print(f"\n全部爬取完成！已成功儲存 {len(all_movies)} 筆電影資料至 {output_file}")
    except Exception as save_err:
        print(f"  [錯誤] 儲存 JSON 檔案時出錯: {save_err}")

if __name__ == "__main__":
    crawl_ssr1_movies()
