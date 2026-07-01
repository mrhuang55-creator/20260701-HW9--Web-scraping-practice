import json
import csv

def convert_json_to_csv():
    json_filename = "movies_results.json"
    csv_filename = "movies_results.csv"
    
    print(f"正在讀取 {json_filename}...")
    try:
        with open(json_filename, "r", encoding="utf-8") as f:
            movies = json.load(f)
            
        print(f"成功讀取 {len(movies)} 筆電影資料。開始轉換為 CSV...")
        
        # 定義 CSV 欄位名稱，包含 UTF-8 BOM 以防 Excel 開啟時亂碼
        fieldnames = ["名稱", "類別", "地區", "片長", "上映日期", "評分", "星等價值"]
        
        with open(csv_filename, "w", newline="", encoding="utf-8-sig") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for movie in movies:
                # 處理類別清單為字串
                cats_list = movie.get("類別", [])
                cats_str = ", ".join(cats_list) if isinstance(cats_list, list) else str(cats_list)
                
                writer.writerow({
                    "名稱": movie.get("名稱"),
                    "類別": cats_str,
                    "地區": movie.get("地區"),
                    "片長": movie.get("片長"),
                    "上映日期": movie.get("上映日期"),
                    "評分": movie.get("評分"),
                    "星等價值": movie.get("星等價值")
                })
                
        print(f"轉換完成！CSV 檔案已儲存至 {csv_filename}")
        
    except FileNotFoundError:
        print(f"錯誤：找不到 {json_filename} 檔案，請確認電影爬蟲是否已成功執行。")
    except Exception as e:
        print(f"轉換過程中發生錯誤: {e}")

if __name__ == "__main__":
    convert_json_to_csv()
