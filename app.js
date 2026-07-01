document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const movieGrid = document.getElementById('movie-grid');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  const regionSelect = document.getElementById('region-select');
  const sortSelect = document.getElementById('sort-select');
  const genresWrapper = document.getElementById('genres-wrapper');
  const movieCountEl = document.getElementById('movie-count');
  
  // Modal Elements
  const movieModal = document.getElementById('movie-modal');
  const modalCloseBtn = document.getElementById('modal-close');
  const modalContent = document.getElementById('modal-detail-content');

  // AI Chat Elements
  const chatToggle = document.getElementById('chat-toggle');
  const chatContainer = document.getElementById('chat-container');
  const chatClose = document.getElementById('chat-close');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  
  // API Settings Elements
  const chatSettingsBtn = document.getElementById('chat-settings-btn');
  const apiSettingsPanel = document.getElementById('api-settings-panel');
  const apiEnableCheckbox = document.getElementById('api-enable-checkbox');
  const apiConfigFields = document.getElementById('api-config-fields');
  const apiProviderSelect = document.getElementById('api-provider-select');
  const apiEndpointContainer = document.getElementById('api-endpoint-container');
  const apiEndpointInput = document.getElementById('api-endpoint-input');
  const apiKeyInput = document.getElementById('api-key-input');
  const apiTestBtn = document.getElementById('api-test-btn');
  const apiTestResult = document.getElementById('api-test-result');

  // Global State
  let moviesData = [];
  let currentGenre = 'all';
  let currentRegion = 'all';
  let searchQuery = '';
  let currentSort = 'default';

  // Chat State
  let chatHistory = [];
  let chatErrorCount = 0;
  let chatLocked = false;
  
  // Initialize
  async function init() {
    try {
      const response = await fetch('movies_results.json');
      if (!response.ok) throw new Error('Failed to load movie data');
      
      moviesData = await response.json();
      
      // Parse names for local matching
      moviesData.forEach(movie => {
        if (movie.名稱) {
          const parts = movie.名稱.split(' - ');
          movie.中文名稱 = parts[0] ? parts[0].trim() : '';
          movie.外文名稱 = parts[1] ? parts[1].trim() : '';
        } else {
          movie.中文名稱 = '';
          movie.外文名稱 = '';
        }
      });
      
      buildFilters();
      renderMovieGrid();
      bindEvents();
      loadApiSettings();
      
    } catch (error) {
      console.error(error);
      movieGrid.innerHTML = `<div class="no-results"><p>載入電影資料發生錯誤：${error.message}</p></div>`;
    }
  }

  function buildFilters() {
    const genresSet = new Set();
    const regionsSet = new Set();

    moviesData.forEach(movie => {
      if (Array.isArray(movie.類別)) {
        movie.類別.forEach(genre => genresSet.add(genre));
      }
      if (movie.地區) {
        movie.地區.split(/[、，,/]/).forEach(r => {
          const trimmed = r.trim();
          if (trimmed) regionsSet.add(trimmed);
        });
      }
    });

    Array.from(regionsSet).sort().forEach(region => {
      const option = document.createElement('option');
      option.value = region;
      option.textContent = region;
      regionSelect.appendChild(option);
    });

    Array.from(genresSet).sort().forEach(genre => {
      const button = document.createElement('button');
      button.className = 'genre-tab';
      button.dataset.genre = genre;
      button.textContent = genre;
      genresWrapper.appendChild(button);
    });
  }

  function renderMovieGrid() {
    let filtered = moviesData.filter(movie => {
      const matchGenre = currentGenre === 'all' || (Array.isArray(movie.類別) && movie.類別.includes(currentGenre));
      const matchRegion = currentRegion === 'all' || (movie.地區 && movie.地區.includes(currentRegion));
      const query = searchQuery.toLowerCase();
      const matchSearch = !query || 
                          movie.名稱.toLowerCase().includes(query) || 
                          (movie.地區 && movie.地區.toLowerCase().includes(query)) ||
                          (Array.isArray(movie.類別) && movie.類別.some(c => c.toLowerCase().includes(query)));
      return matchGenre && matchRegion && matchSearch;
    });

    if (currentSort === 'rating-desc') {
      filtered.sort((a, b) => parseFloat(b.評分) - parseFloat(a.評分));
    } else if (currentSort === 'date-desc') {
      filtered.sort((a, b) => {
        if (a.上映日期 === '未知') return 1;
        if (b.上映日期 === '未知') return -1;
        return b.上映日期.localeCompare(a.上映日期);
      });
    } else if (currentSort === 'date-asc') {
      filtered.sort((a, b) => {
        if (a.上映日期 === '未知') return 1;
        if (b.上映日期 === '未知') return -1;
        return a.上映日期.localeCompare(b.上映日期);
      });
    }

    movieCountEl.textContent = filtered.length;

    if (filtered.length === 0) {
      movieGrid.innerHTML = `<div class="no-results"><p>沒有找到符合條件的電影！</p></div>`;
      return;
    }

    movieGrid.innerHTML = '';
    filtered.forEach(movie => {
      const card = document.createElement('div');
      card.className = 'movie-card';
      let posterSrc = movie.封面 || '';
      let filename = posterSrc.startsWith('.') ? posterSrc.split('/').pop() : '';
      
      const tagsHTML = Array.isArray(movie.類別) 
        ? movie.類別.map(tag => `<span class="movie-tag">${tag}</span>`).join('') 
        : '';

      card.innerHTML = `
        <div class="movie-poster-container">
          <img src="${posterSrc}" alt="${movie.名稱}" data-filename="${filename}" onerror="handleImageError(this)">
          <div class="movie-rating-badge">${movie.評分}</div>
        </div>
        <div class="movie-body">
          <h3 class="movie-title">${movie.名稱}</h3>
          <div class="movie-tags">${tagsHTML}</div>
          <div class="movie-meta-info">
            <div class="meta-row"><span>📅</span><span>${movie.上映日期 || '未知'}</span></div>
            <div class="meta-row"><span>📍</span><span>${movie.地區 || '未知'}</span></div>
          </div>
        </div>
      `;
      card.addEventListener('click', () => openModal(movie));
      movieGrid.appendChild(card);
    });
  }

  function bindEvents() {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
      renderMovieGrid();
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      renderMovieGrid();
      searchInput.focus();
    });

    regionSelect.addEventListener('change', (e) => {
      currentRegion = e.target.value;
      renderMovieGrid();
    });

    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderMovieGrid();
    });

    genresWrapper.addEventListener('click', (e) => {
      const tab = e.target.closest('.genre-tab');
      if (!tab) return;
      document.querySelectorAll('.genre-tab').forEach(btn => btn.classList.remove('active'));
      tab.classList.add('active');
      currentGenre = tab.dataset.genre;
      renderMovieGrid();
    });

    modalCloseBtn.addEventListener('click', closeModal);
    movieModal.addEventListener('click', (e) => {
      if (e.target === movieModal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && movieModal.classList.contains('open')) closeModal();
    });

    // Chat Events
    chatToggle.addEventListener('click', () => chatContainer.classList.add('open'));
    chatClose.addEventListener('click', () => chatContainer.classList.remove('open'));
    chatSend.addEventListener('click', handleChatSubmit);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleChatSubmit();
    });

    // API Settings Events
    chatSettingsBtn.addEventListener('click', () => {
      apiSettingsPanel.style.display = apiSettingsPanel.style.display === 'none' ? 'block' : 'none';
    });
    apiEnableCheckbox.addEventListener('change', (e) => {
      apiConfigFields.style.display = e.target.checked ? 'block' : 'none';
      saveApiSettings();
    });
    apiProviderSelect.addEventListener('change', (e) => {
      apiEndpointContainer.style.display = e.target.value === 'opencode' ? 'block' : 'none';
      saveApiSettings();
    });
    apiEndpointInput.addEventListener('input', saveApiSettings);
    apiKeyInput.addEventListener('input', saveApiSettings);
    apiTestBtn.addEventListener('click', testApiConnection);
  }

  function openModal(movie) {
    let posterSrc = movie.封面 || '';
    let filename = posterSrc.startsWith('.') ? posterSrc.split('/').pop() : '';
    
    // 星等渲染
    const ratingVal = movie.星等價值 || 0;
    const fullStars = Math.floor(ratingVal);
    const hasHalf = ratingVal % 1 >= 0.5;
    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        starsHTML += '<span>★</span>';
      } else if (i === fullStars + 1 && hasHalf) {
        starsHTML += '<span>⯪</span>';
      } else {
        starsHTML += '<span class="star-empty">★</span>';
      }
    }

    modalContent.innerHTML = `
      <div class="modal-detail-layout" style="display:flex; flex-wrap:wrap; gap:1.5rem;">
        <div class="modal-poster" style="flex:1; min-width: 250px;">
          <img src="${posterSrc}" alt="${movie.名稱}" data-filename="${filename}" onerror="handleImageError(this)" style="width:100%; border-radius:12px; box-shadow:0 8px 16px rgba(0,0,0,0.2);">
        </div>
        <div class="modal-info" style="flex:2; min-width: 300px;">
          <div class="modal-header">
            <h2 style="margin-bottom:0.5rem; font-size:1.8rem; font-weight:800; color:var(--accent-color);">${movie.名稱}</h2>
            <div class="modal-rating" style="margin-bottom:1rem; font-size:1.2rem;">
              <span class="rating-score" style="font-weight:bold; color:#FFD700;">${movie.評分}</span>
              <div class="stars" style="color:#FFD700; display:inline-block; margin-left:10px;">${starsHTML}</div>
            </div>
          </div>
          <div class="modal-tags" style="margin-bottom:1rem;">
            ${Array.isArray(movie.類別) ? movie.類別.map(tag => `<span class="movie-tag" style="background:var(--accent-secondary); color:white; padding:4px 8px; border-radius:12px; margin-right:5px; font-size:0.85rem;">${tag}</span>`).join('') : ''}
          </div>
          <div class="modal-meta" style="line-height:1.8; color:var(--text-color);">
            <p><strong>中文名稱:</strong> ${movie.中文名稱}</p>
            <p><strong>外文名稱:</strong> ${movie.外文名稱}</p>
            <p><strong>地區:</strong> ${movie.地區 || '未知'}</p>
            <p><strong>片長:</strong> ${movie.片長 || '未知'}</p>
            <p><strong>上映日期:</strong> ${movie.上映日期 || '未知'}</p>
          </div>
        </div>
      </div>
    `;
    movieModal.classList.add('open');
  }

  function closeModal() {
    movieModal.classList.remove('open');
  }

  // AI Chat Logic
  function appendChatMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}`;
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function loadApiSettings() {
    const settings = JSON.parse(localStorage.getItem('cinescrape_api_settings') || '{}');
    apiEnableCheckbox.checked = !!settings.enabled;
    apiProviderSelect.value = settings.provider || 'openai';
    apiEndpointInput.value = settings.endpoint || '';
    apiKeyInput.value = settings.apiKey || '';
    
    apiConfigFields.style.display = apiEnableCheckbox.checked ? 'block' : 'none';
    apiEndpointContainer.style.display = apiProviderSelect.value === 'opencode' ? 'block' : 'none';
  }

  function saveApiSettings() {
    const settings = {
      enabled: apiEnableCheckbox.checked,
      provider: apiProviderSelect.value,
      endpoint: apiEndpointInput.value.trim(),
      apiKey: apiKeyInput.value.trim()
    };
    localStorage.setItem('cinescrape_api_settings', JSON.stringify(settings));
  }

  async function testApiConnection() {
    apiTestBtn.disabled = true;
    apiTestResult.style.color = '#333';
    apiTestResult.textContent = '連線測試中...';
    
    const provider = apiProviderSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const endpoint = apiEndpointInput.value.trim();
    
    if (!apiKey) {
      apiTestResult.style.color = 'red';
      apiTestResult.textContent = '錯誤：請輸入 API Key';
      apiTestBtn.disabled = false;
      return;
    }

    try {
      let url, headers, body;
      
      if (provider === 'openai') {
        url = 'https://api.openai.com/v1/chat/completions';
        headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey };
        body = JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 });
      } else if (provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] });
      } else if (provider === 'opencode') {
        url = endpoint || 'https://api.openai.com/v1/chat/completions'; 
        headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey };
        body = JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 });
      }

      const res = await fetch(url, { method: 'POST', headers, body });
      if (!res.ok) throw new Error(`連線失敗 (${res.status})`);
      
      apiTestResult.style.color = 'green';
      apiTestResult.textContent = '連線成功！API 設定已儲存。';
      saveApiSettings();
    } catch (err) {
      apiTestResult.style.color = 'red';
      apiTestResult.textContent = '測試失敗：' + err.message;
    } finally {
      apiTestBtn.disabled = false;
    }
  }

  function handleLockout() {
    chatLocked = true;
    chatInput.disabled = true;
    chatSend.disabled = true;
    let seconds = 15;
    chatInput.placeholder = `錯誤過多，鎖定 ${seconds} 秒...`;
    
    const interval = setInterval(() => {
      seconds--;
      if (seconds > 0) {
        chatInput.placeholder = `錯誤過多，鎖定 ${seconds} 秒...`;
      } else {
        clearInterval(interval);
        chatLocked = false;
        chatErrorCount = 0;
        chatInput.disabled = false;
        chatSend.disabled = false;
        chatInput.placeholder = "問問我關於電影的事...";
      }
    }, 1000);
  }

  function registerError() {
    chatErrorCount++;
    if (chatErrorCount >= 3) {
      handleLockout();
    }
  }

  function matchLocalFeatures(query) {
    let matchedMovies = [];
    moviesData.forEach(m => {
      const cName = m.中文名稱.toLowerCase();
      const fName = m.外文名稱.toLowerCase();
      const region = (m.地區 || '').toLowerCase();
      const genres = Array.isArray(m.類別) ? m.類別.map(g => g.toLowerCase()) : [];
      
      if (
        (cName && query.includes(cName)) ||
        (fName && query.includes(fName)) ||
        (region && query.includes(region)) ||
        genres.some(g => query.includes(g))
      ) {
        matchedMovies.push(m);
      }
    });
    return matchedMovies.slice(0, 3); // Max 3 suggestions
  }

  async function handleChatSubmit() {
    if (chatLocked) return;
    const rawQuery = chatInput.value.trim();
    const query = rawQuery.toLowerCase();
    if (!query) return;

    appendChatMessage('user', rawQuery);
    chatInput.value = '';

    const settings = JSON.parse(localStorage.getItem('cinescrape_api_settings') || '{}');

    if (!settings.enabled) {
      // 本地特徵配對模式
      const matches = matchLocalFeatures(query);
      if (matches.length > 0) {
        chatErrorCount = 0; // 成功配對，重置錯誤
        let reply = "根據您的特徵，推薦以下電影：\n";
        matches.forEach(m => {
          reply += `- ${m.名稱} (${m.評分}分)\n`;
        });
        appendChatMessage('bot', reply);
      } else {
        appendChatMessage('bot', "請輸入特徵(例如中外文名稱、地區、類型)或是連結API獲得更好回應。");
        registerError(); // 配對失敗，計算錯誤
      }
      return;
    }

    // API 模式
    chatInput.disabled = true;
    chatSend.disabled = true;
    chatSend.textContent = '思考中...';

    const provider = settings.provider;
    const apiKey = settings.apiKey;
    const endpoint = settings.endpoint;

    try {
      let botResponse = "";
      
      if (provider === 'openai' || provider === 'opencode') {
        const url = provider === 'opencode' && endpoint ? endpoint : 'https://api.openai.com/v1/chat/completions';
        // 移除 100 部限制，使其可以自由對話
        const systemPrompt = "你是一個在電影推薦網站服務的 AI 智慧助手，名字叫 CineScrape 智能海灘小夥伴。請用夏日、度假、海灘的風格與用戶對話，不受限於特定電影清單，可以自由回答用戶的問題。必須以「繁體中文」回答。";
        
        const messages = [{ role: 'system', content: systemPrompt }];
        chatHistory.forEach(msg => messages.push(msg));
        messages.push({ role: 'user', content: rawQuery });

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.7 })
        });
        
        if (!res.ok) throw new Error(`API 錯誤 (${res.status})`);
        const data = await res.json();
        botResponse = data.choices[0].message.content.trim();
        
      } else if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        let contents = [];
        chatHistory.forEach(msg => {
          contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] });
        });
        contents.push({ role: 'user', parts: [{ text: rawQuery }] });
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: "你是一個在電影推薦網站服務的 AI 智慧助手。請用夏日、海灘風格與用戶對話，不受限特定電影，可以自由回答問題。必須以繁體中文回答。" }] }
          })
        });
        
        if (!res.ok) throw new Error(`API 錯誤 (${res.status})`);
        const data = await res.json();
        botResponse = data.candidates[0].content.parts[0].text.trim();
      }

      appendChatMessage('bot', botResponse);
      chatErrorCount = 0; // 重置錯誤
      
      chatHistory.push({ role: 'user', content: rawQuery });
      chatHistory.push({ role: 'assistant', content: botResponse });
      if (chatHistory.length > 10) {
        chatHistory = chatHistory.slice(-10);
      }
      
    } catch (err) {
      console.error(err);
      appendChatMessage('bot', `哎呀！海浪好像把網路訊號捲走了... 🌊 請再試一次！(錯誤詳情: ${err.message})`);
      registerError(); // API 連線錯誤也算錯誤
    } finally {
      if (!chatLocked) {
        chatInput.disabled = false;
        chatSend.disabled = false;
        chatSend.textContent = '傳送';
        chatInput.focus();
      }
    }
  }

  init();
});

function handleImageError(imgElement) {
  const filename = imgElement.dataset.filename;
  if (filename) {
    imgElement.onerror = () => {
      imgElement.onerror = null;
      imgElement.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
    };
    imgElement.src = `https://p0.meituan.net/movie/${filename}`;
  } else {
    imgElement.onerror = null;
    imgElement.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';
  }
}
