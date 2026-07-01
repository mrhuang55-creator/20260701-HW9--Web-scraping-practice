import streamlit as st
import json
import requests
import time
from datetime import datetime, timedelta

# 頁面配置
st.set_page_config(page_title="CineScrape | 電影探索", page_icon="🌴", layout="wide")

# 初始化 Session State
if 'chat_history' not in st.session_state:
    st.session_state.chat_history = []
if 'chat_error_count' not in st.session_state:
    st.session_state.chat_error_count = 0
if 'chat_lock_until' not in st.session_state:
    st.session_state.chat_lock_until = None
if 'api_settings' not in st.session_state:
    st.session_state.api_settings = {
        'enabled': False,
        'provider': 'openai',
        'endpoint': '',
        'api_key': ''
    }

# 讀取與處理電影資料
@st.cache_data
def load_movies():
    try:
        with open('movies_results.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            # 解析中外文名稱
            for movie in data:
                if '名稱' in movie:
                    parts = movie['名稱'].split(' - ')
                    movie['中文名稱'] = parts[0].strip() if len(parts) > 0 else ''
                    movie['外文名稱'] = parts[1].strip() if len(parts) > 1 else ''
                else:
                    movie['中文名稱'] = ''
                    movie['外文名稱'] = ''
            return data
    except Exception as e:
        st.error(f"載入電影資料失敗: {e}")
        return []

movies_data = load_movies()

# --- 側邊欄 ---
st.sidebar.title("🌴 CineScrape 設定")

# 1. 電影篩選
st.sidebar.subheader("🔍 篩選電影")
search_query = st.sidebar.text_input("搜尋關鍵字 (名稱/地區/類型)")

# 取得所有地區與類型
all_regions = set()
all_genres = set()
for m in movies_data:
    if '地區' in m and m['地區']:
        import re
        regions = re.split(r'[、，,/]', m['地區'])
        for r in regions:
            if r.strip(): all_regions.add(r.strip())
    if '類別' in m and isinstance(m['類別'], list):
        for g in m['類別']:
            all_genres.add(g)

selected_region = st.sidebar.selectbox("地區", ["全部"] + sorted(list(all_regions)))
selected_genre = st.sidebar.selectbox("類型", ["全部"] + sorted(list(all_genres)))

# 2. API 設定
st.sidebar.subheader("⚙️ API 設定")
api_enabled = st.sidebar.checkbox("啟用 API (不使用本地特徵推薦)", value=st.session_state.api_settings['enabled'])
st.session_state.api_settings['enabled'] = api_enabled

if api_enabled:
    provider = st.sidebar.selectbox("API 服務商", ["openai", "gemini", "opencode"], 
                                    index=["openai", "gemini", "opencode"].index(st.session_state.api_settings['provider']))
    st.session_state.api_settings['provider'] = provider
    
    if provider == "opencode":
        endpoint = st.sidebar.text_input("API 端點 (Base URL)", value=st.session_state.api_settings['endpoint'])
        st.session_state.api_settings['endpoint'] = endpoint
        
    api_key = st.sidebar.text_input("API Key", type="password", value=st.session_state.api_settings['api_key'])
    st.session_state.api_settings['api_key'] = api_key
    
    if st.sidebar.button("測試連線"):
        if not api_key:
            st.sidebar.error("請輸入 API Key！")
        else:
            try:
                if provider == "openai":
                    url = 'https://api.openai.com/v1/chat/completions'
                    headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}
                    body = {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 5}
                elif provider == "gemini":
                    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={api_key}'
                    headers = {'Content-Type': 'application/json'}
                    body = {"contents": [{"parts": [{"text": "Hello"}]}]}
                elif provider == "opencode":
                    url = st.session_state.api_settings['endpoint'] or 'https://api.openai.com/v1/chat/completions'
                    headers = {'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}
                    body = {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 5}
                
                res = requests.post(url, headers=headers, json=body, timeout=10)
                if res.status_code == 200:
                    st.sidebar.success("✅ 連線成功！")
                else:
                    st.sidebar.error(f"❌ 連線失敗 ({res.status_code}): {res.text}")
            except Exception as e:
                st.sidebar.error(f"❌ 測試錯誤: {str(e)}")

# --- 主畫面 ---
st.title("🎬 CineScrape 精選電影殿堂")
st.markdown("享受夏日海灘風格的電影探索之旅。")

# 過濾電影
filtered_movies = []
query_lower = search_query.lower()
for m in movies_data:
    match_genre = (selected_genre == "全部") or ('類別' in m and selected_genre in m['類別'])
    match_region = (selected_region == "全部") or ('地區' in m and selected_region in m['地區'])
    match_search = False
    if not query_lower:
        match_search = True
    else:
        c_name = m.get('中文名稱', '').lower()
        f_name = m.get('外文名稱', '').lower()
        reg = m.get('地區', '').lower()
        genres = [g.lower() for g in m.get('類別', [])]
        if query_lower in c_name or query_lower in f_name or query_lower in reg or any(query_lower in g for g in genres):
            match_search = True
            
    if match_genre and match_region and match_search:
        filtered_movies.append(m)

st.write(f"共找到 **{len(filtered_movies)}** 部電影")

# 展示網格
cols = st.columns(4)
for idx, movie in enumerate(filtered_movies):
    with cols[idx % 4]:
        # Fallback image logic is tricky in pure Streamlit without frontend JS, we'll try Meituan CDN or Fallback directly
        poster_src = movie.get('封面', '')
        fallback_img = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60'
        
        # If relative path, try meituan CDN
        if poster_src.startswith('.'):
            filename = poster_src.split('/')[-1]
            poster_src = f"https://p0.meituan.net/movie/{filename}"
            
        try:
            st.image(poster_src, use_column_width=True)
        except:
            st.image(fallback_img, use_column_width=True)
            
        st.markdown(f"**{movie['名稱']}**")
        st.caption(f"⭐ {movie.get('評分', 'N/A')} | 📅 {movie.get('上映日期', '未知')}")
        if '類別' in movie:
            st.markdown(" ".join([f"`{g}`" for g in movie['類別']]))
        st.divider()

# --- AI 助手聊天區 ---
st.markdown("---")
st.subheader("💬 CineScrape AI 助手")

# 檢查鎖定狀態並處理倒數 (避免死結)
if st.session_state.chat_lock_until:
    if datetime.now() < st.session_state.chat_lock_until:
        lock_placeholder = st.empty()
        while True:
            remaining = int((st.session_state.chat_lock_until - datetime.now()).total_seconds())
            if remaining <= 0:
                st.session_state.chat_lock_until = None
                st.session_state.chat_error_count = 0
                st.rerun()
            lock_placeholder.error(f"錯誤次數過多，鎖定中... 請等待 {remaining} 秒")
            time.sleep(1)
    else:
        st.session_state.chat_lock_until = None
        st.session_state.chat_error_count = 0

# 顯示聊天記錄
for msg in st.session_state.chat_history:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

def register_error():
    st.session_state.chat_error_count += 1
    if st.session_state.chat_error_count >= 3:
        st.session_state.chat_lock_until = datetime.now() + timedelta(seconds=15)
        st.rerun()

def match_local_features(query):
    query = query.lower()
    matches = []
    for m in movies_data:
        c_name = m.get('中文名稱', '').lower()
        f_name = m.get('外文名稱', '').lower()
        reg = m.get('地區', '').lower()
        genres = [g.lower() for g in m.get('類別', [])]
        if (c_name and query in c_name) or (f_name and query in f_name) or (reg and query in reg) or any(query in g for g in genres):
            matches.append(m)
    return matches[:3]

# 聊天輸入框
user_input = st.chat_input("問問我關於電影的事...")
if user_input:
    # 新增使用者訊息
    st.session_state.chat_history.append({"role": "user", "content": user_input})
    with st.chat_message("user"):
        st.markdown(user_input)
        
    settings = st.session_state.api_settings
    
    with st.chat_message("assistant"):
        if not settings['enabled']:
            # 無 API 特徵配對
            matches = match_local_features(user_input)
            if matches:
                st.session_state.chat_error_count = 0
                reply = "根據您的特徵，推薦以下電影：\n\n"
                for m in matches:
                    reply += f"- **{m['名稱']}** ({m.get('評分')}分)\n"
                st.markdown(reply)
                st.session_state.chat_history.append({"role": "assistant", "content": reply})
            else:
                error_msg = "請輸入特徵(例如中外文名稱、地區、類型)或是連結API獲得更好回應。"
                st.markdown(error_msg)
                st.session_state.chat_history.append({"role": "assistant", "content": error_msg})
                register_error()
        else:
            # 呼叫 API
            provider = settings['provider']
            api_key = settings['api_key']
            endpoint = settings['endpoint']
            
            try:
                bot_reply = ""
                if provider in ["openai", "opencode"]:
                    url = endpoint if (provider == 'opencode' and endpoint) else 'https://api.openai.com/v1/chat/completions'
                    sys_prompt = "你是一個在電影推薦網站服務的 AI 智慧助手，名字叫 CineScrape 智能海灘小夥伴。請用夏日、度假、海灘的風格與用戶對話，不受限於特定電影清單，可以自由回答用戶的問題。必須以「繁體中文」回答。"
                    messages = [{"role": "system", "content": sys_prompt}]
                    for msg in st.session_state.chat_history[-10:]:
                        if msg["role"] != "system":
                            messages.append(msg)
                            
                    res = requests.post(url, headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}, json={
                        "model": "gpt-4o-mini",
                        "messages": messages,
                        "temperature": 0.7
                    }, timeout=15)
                    if res.status_code == 200:
                        bot_reply = res.json()['choices'][0]['message']['content'].strip()
                    else:
                        raise Exception(f"API 錯誤 ({res.status_code})")
                        
                elif provider == "gemini":
                    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={api_key}'
                    contents = []
                    for msg in st.session_state.chat_history[-10:]:
                        contents.append({
                            "role": "model" if msg["role"] == "assistant" else "user",
                            "parts": [{"text": msg["content"]}]
                        })
                    res = requests.post(url, headers={'Content-Type': 'application/json'}, json={
                        "contents": contents,
                        "systemInstruction": {"parts": [{"text": "你是一個在電影推薦網站服務的 AI 智慧助手。請用夏日、海灘風格與用戶對話，不受限特定電影，可以自由回答問題。必須以繁體中文回答。"}]}
                    }, timeout=15)
                    
                    if res.status_code == 200:
                        bot_reply = res.json()['candidates'][0]['content']['parts'][0]['text'].strip()
                    else:
                        raise Exception(f"API 錯誤 ({res.status_code})")
                        
                st.markdown(bot_reply)
                st.session_state.chat_history.append({"role": "assistant", "content": bot_reply})
                st.session_state.chat_error_count = 0
            except Exception as e:
                err_msg = f"哎呀！發生錯誤了... 🌊 ({str(e)})"
                st.markdown(err_msg)
                st.session_state.chat_history.append({"role": "assistant", "content": err_msg})
                register_error()
