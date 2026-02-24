// ==================================================
// 📰 NEWS FEATURE - NewsData.io Integration
// ==================================================

const NEWS_API_KEY = 'pub_81e9fbb1558843c1b88da57692d26e60';
const NEWS_API_BASE = 'https://newsdata.io/api/1/latest';

let currentNewsData = [];
let displayedCount = 0;
const ARTICLES_PER_LOAD = 5;

// ==================================================
// INITIALIZATION
// ==================================================

export function initNews(store) {
  const btnNews = document.getElementById('btnNews');

  if (btnNews) {
    btnNews.addEventListener('click', () => {
      showNewsInterface(store);
    });
  }
}

// ==================================================
// NEWS INTERFACE - Integrated into chat
// ==================================================

function showNewsInterface(store) {
  addSystemMessage('📰 Loading latest news from India...');
  loadNews('', 'in');
}

function addSystemMessage(text) {
  const messagesContainer = document.getElementById('messages');

  const systemMsg = document.createElement('div');
  systemMsg.className = 'bot-msg';
  systemMsg.innerHTML = `<div class="bot-text">${text}</div>`;

  messagesContainer.appendChild(systemMsg);
  scrollToBottom();
}

function addNewsSearchInterface() {
  const messagesContainer = document.getElementById('messages');

  const existing = document.querySelector('.news-search-interface');
  if (existing) existing.remove();

  const searchInterface = document.createElement('div');
  searchInterface.className = 'bot-msg';

  searchInterface.innerHTML = `
    <div class="news-search-interface native-card">
      <div class="native-card-header">
        <div class="native-card-icon">🔍</div>
        <div class="native-card-title-section">
          <div class="native-card-badge">Search Topics</div>
          <div class="native-card-subtitle">Find latest updates worldwide</div>
        </div>
      </div>
      
      <div class="news-search-controls">
        <div class="native-input-group">
          <input type="text" class="news-search-input native-input" placeholder="Search topics (e.g., AI, sports)..."/>
          <select class="news-country-select native-select">
            <option value="in">🇮🇳 India</option>
            <option value="us">🇺🇸 USA</option>
            <option value="gb">🇬🇧 UK</option>
            <option value="ca">🇨🇦 Canada</option>
            <option value="au">🇦🇺 Australia</option>
            <option value="jp">🇯🇵 Japan</option>
          </select>
        </div>
        <button class="news-search-submit native-button-primary">Search News</button>
      </div>
    </div>
  `;

  messagesContainer.appendChild(searchInterface);
  scrollToBottom();

  const searchBtn = searchInterface.querySelector('.news-search-submit');
  const searchInput = searchInterface.querySelector('.news-search-input');
  const countrySelect = searchInterface.querySelector('.news-country-select');

  const triggerSearch = () => {
    const query = searchInput.value.trim();
    const country = countrySelect.value;
    currentNewsData = [];
    displayedCount = 0;

    document.querySelectorAll('.news-article-card, .news-load-more-container, .news-ask-all-container, .news-search-interface').forEach(el => {
      el.closest('.bot-msg')?.remove();
    });

    addSystemMessage(`🔍 Searching for ${query || 'latest news'} in ${getCountryName(country)}...`);
    loadNews(query, country);
  };

  searchBtn.onclick = triggerSearch;
  searchInput.onkeypress = (e) => { if (e.key === 'Enter') triggerSearch(); };
}

function getCountryName(code) {
  const countries = { 'in': 'India', 'us': 'USA', 'gb': 'UK', 'ca': 'Canada', 'au': 'Australia', 'de': 'Germany', 'fr': 'France', 'jp': 'Japan', 'cn': 'China', 'br': 'Brazil' };
  return countries[code] || code;
}

// ==================================================
// API FUNCTIONS
// ==================================================

async function loadNews(query = '', country = 'in') {
  const messagesContainer = document.getElementById('messages');

  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'bot-msg news-loading-msg';
  loadingMsg.innerHTML = `<div class="bot-text"><div class="news-loading-indicator"><div class="news-spinner"></div><span>Fetching latest news...</span></div></div>`;
  messagesContainer.appendChild(loadingMsg);
  scrollToBottom();

  try {
    let url = `${NEWS_API_BASE}?apikey=${NEWS_API_KEY}&country=${country}&language=en`;
    if (query) url += `&q=${encodeURIComponent(query)}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    loadingMsg.remove();

    if (data.status === 'success' && data.results && data.results.length > 0) {
      currentNewsData = data.results;
      displayedCount = 0;

      const headerMsg = document.createElement('div');
      headerMsg.className = 'bot-msg';
      headerMsg.innerHTML = `<div class="bot-text"><strong>📰 Found ${data.results.length} news articles</strong></div>`;
      messagesContainer.appendChild(headerMsg);

      displayMoreArticles();
    } else {
      addSystemMessage('❌ No news articles found. Try a different search.');
      addNewsSearchInterface();
    }
  } catch (error) {
    loadingMsg.remove();
    addSystemMessage(`⚠️ Error: ${error.message}`);
    addNewsSearchInterface();
  }
}

// ==================================================
// RENDER & NAVIGATION
// ==================================================

function displayMoreArticles() {
  const remaining = currentNewsData.length - displayedCount;
  const articlesToShow = Math.min(ARTICLES_PER_LOAD, remaining);

  document.querySelectorAll('.news-navigation-controls').forEach(el => el.closest('.bot-msg')?.remove());

  for (let i = 0; i < articlesToShow; i++) {
    renderNewsArticle(currentNewsData[displayedCount + i], displayedCount + i);
  }

  displayedCount += articlesToShow;

  addNavigationControls();
}

function renderNewsArticle(article, index) {
  const messagesContainer = document.getElementById('messages');
  const imageUrl = article.image_url || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400';
  const pubDate = article.pubDate ? formatDate(article.pubDate) : 'Recently';

  const newsCard = document.createElement('div');
  newsCard.className = 'bot-msg';
  newsCard.innerHTML = `
    <div class="native-card news-article-card">
      <div class="native-card-content">
        <div class="native-card-thumbnail">
          <img src="${imageUrl}" alt="News" onerror="this.src='https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400'">
          <div class="native-card-badge-overlay">${escapeHTML(article.source_name || 'News')}</div>
        </div>
        <div class="native-card-info">
          <div class="native-card-title">${escapeHTML(article.title || 'Untitled')}</div>
          <div class="native-card-subtitle">🕒 ${pubDate}</div>
          <div class="native-card-description">${escapeHTML(article.description || '').substring(0, 100)}...</div>
        </div>
      </div>
      
      <div class="native-card-actions">
        <button class="native-action-btn primary news-ask-ai" data-index="${index}">
          <span class="action-icon">💬</span>
          <div class="action-text">
            <div class="action-label">Ask AI</div>
            <div class="action-desc">Analyze this story</div>
          </div>
        </button>
        <button class="native-action-btn secondary news-read-more" data-url="${article.link}">
          <span class="action-icon">📖</span>
          <div class="action-text">
            <div class="action-label">Read Full</div>
            <div class="action-desc">Open original source</div>
          </div>
        </button>
      </div>
    </div>
  `;

  messagesContainer.appendChild(newsCard);

  newsCard.querySelector('.news-ask-ai').onclick = () => handleAskAI(article);
  newsCard.querySelector('.news-read-more').onclick = () => {
    if (article.link) chrome.tabs.create({ url: article.link });
  };
}

function addNavigationControls() {
  const messagesContainer = document.getElementById('messages');
  const remaining = currentNewsData.length - displayedCount;

  const controls = document.createElement('div');
  controls.className = 'bot-msg news-navigation-controls';

  let html = `<div class="news-nav-buttons">`;

  if (remaining > 0) {
    html += `
      <button class="native-button-secondary load-more-news">
        <span>📰 Load More Articles (${remaining})</span>
      </button>
    `;
  }

  html += `
      <button class="native-button-primary ask-all-news">
        <span>🤖 Analyze All Articles</span>
      </button>
      <button class="native-button-minimal search-again-news">
        <span>🔍 New Search</span>
      </button>
    </div>
  `;

  controls.innerHTML = html;
  messagesContainer.appendChild(controls);
  scrollToBottom();

  if (controls.querySelector('.load-more-news')) {
    controls.querySelector('.load-more-news').onclick = displayMoreArticles;
  }

  controls.querySelector('.search-again-news').onclick = addNewsSearchInterface;

  controls.querySelector('.ask-all-news').onclick = () => {
    const summary = currentNewsData.slice(0, 10).map((a, i) => `${i + 1}. ${a.title}`).join('\n');
    if (window.sendMessage) window.sendMessage(`Summarize and analyze these news stories:\n\n${summary}`);
  };
}

// ==================================================
// UTILS
// ==================================================

function handleAskAI(article) {
  const prompt = `Analyze this news story: **${article.title}**\n\nSource: ${article.source_name}\n\n${article.description}\n\nPlease provide key takeaways and significance.`;
  if (window.sendMessage) window.sendMessage(prompt);
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    const diff = Math.floor((new Date() - date) / 3600000);
    if (diff < 1) return 'Just now';
    if (diff < 24) return `${diff}h ago`;
    return date.toLocaleDateString();
  } catch { return dateString; }
}

function escapeHTML(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function scrollToBottom() {
  const m = document.getElementById('messages');
  if (m) m.scrollTop = m.scrollHeight;
}