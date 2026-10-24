// -------------------------------------------------------------
// API CLIENT LAYER
// -------------------------------------------------------------
const API = {
  async getDashboard() {
    const res = await fetch('/api/dashboard');
    return res.json();
  },

  async getTopics() {
    const res = await fetch('/api/topics');
    return res.json();
  },

  async getReviewSession({ category, value, limit = 20 }) {
    let url = `/api/review-session?limit=${limit}&`;
    if (category === 'topic' && value) {
      url += `topicId=${encodeURIComponent(value)}`;
    } else if (category === 'specialty' && value) {
      url += `specialty=${encodeURIComponent(value)}`;
    } else if (category === 'context' && value) {
      url += `context=${encodeURIComponent(value)}`;
    }
    const res = await fetch(url);
    return res.json();
  },

  async postReview(wordId, payload) {
    const body = typeof payload === 'object' ? { wordId, ...payload } : { wordId, correct: payload };
    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  },

  async getDictionary({ search = '', srsLevel = 'all', starred = false, topicId = '', letter = '', limit = 100 }) {
    let url = `/api/words/dictionary?limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (srsLevel !== 'all') url += `&srsLevel=${encodeURIComponent(srsLevel)}`;
    if (starred) url += `&starred=1`;
    if (topicId) url += `&topicId=${encodeURIComponent(topicId)}`;
    if (letter) url += `&letter=${encodeURIComponent(letter)}`;

    const res = await fetch(url);
    return res.json();
  },

  async postStar(wordId) {
    const res = await fetch(`/api/words/${wordId}/star`, { method: 'POST' });
    return res.json();
  },

  async putWord(wordId, data) {
    const res = await fetch(`/api/words/${wordId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getClozeSession(limit = 15) {
    const res = await fetch(`/api/cloze-session?limit=${limit}`);
    return res.json();
  },

  async getForecast() {
    const res = await fetch('/api/review-forecast');
    return res.json();
  },

  async getReadingSession(part = 5, limit = 10) {
    const res = await fetch(`/api/reading/session?part=${part}&limit=${limit}`);
    return res.json();
  },

  async submitReadingAnswers(answers) {
    const res = await fetch('/api/reading/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers })
    });
    return res.json();
  },

  async addReadingVocabToSRS(data) {
    const res = await fetch('/api/reading/add-vocab-to-srs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getWordDropWords({ topicId = '', limit = 30, mode = 'srs' } = {}) {
    let url = `/api/word-drop/words?limit=${limit}&mode=${mode}`;
    if (topicId) url += `&topic_id=${encodeURIComponent(topicId)}`;
    const res = await fetch(url);
    return res.json();
  },

  async postWordDropResult(payload) {
    const res = await fetch('/api/word-drop/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async exportBackup() {
    window.location.href = '/api/export-backup';
  },

  async importBackup(data) {
    const res = await fetch('/api/import-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi khôi phục');
    }
    return res.json();
  },

  async getSettings() {
    const res = await fetch('/api/settings');
    return res.json();
  },

  async postSettings(geminiApiKey) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geminiApiKey })
    });
    return res.json();
  },

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('vocabFile', file);
    const res = await fetch('/api/upload-file', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi tải lên file');
    }
    return res.json();
  },

  async postImportManual(topicName, content) {
    const res = await fetch('/api/import-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicName, content })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Lỗi nhập thủ công');
    }
    return res.json();
  },

  async resetAll() {
    const res = await fetch('/api/reset', { method: 'POST' });
    return res.json();
  }
};

// -------------------------------------------------------------
// UI CONTROLLER & VIEW ROUTER
// -------------------------------------------------------------
const App = {
  currentView: 'dashboard',
  sessionWords: [],
  currentWordIndex: 0,
  sessionResults: {
    correct: 0,
    incorrect: 0,
    reviewedIds: []
  },

  // Matching game state
  matchingCards: [],
  selectedMatchingCard: null,
  gameScore: 0,
  gameTimer: null,
  timeLeft: 60,

  // Speed test state
  speedTimer: null,
  speedTimeLeft: 60,
  speedScore: 0,
  speedQuestions: [],
  speedCurrentIndex: 0,

  // Cloze test state
  clozeQuestions: [],
  clozeCurrentIndex: 0,

  // Dictionary state
  dictParams: {
    search: '',
    srsLevel: 'all',
    starred: false,
    letter: ''
  },
  searchDebounceTimer: null,

  sessionSize: parseInt(localStorage.getItem('toeic_session_size') || '20'),
  lastSessionContext: null,

  init() {
    window.addEventListener('hashchange', () => this.route());
    this.bindEvents();
    this.initSessionSizeControls();
    this.route();
    this.registerServiceWorker();
  },

  initSessionSizeControls() {
    const currentSize = this.sessionSize || 20;
    document.querySelectorAll('.session-size-btn').forEach(btn => {
      const btnSize = parseInt(btn.dataset.size);
      if (btnSize === currentSize) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      btn.onclick = () => {
        document.querySelectorAll('.session-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.sessionSize = btnSize;
        localStorage.setItem('toeic_session_size', btnSize);
        showToast(btnSize >= 200 ? 'Đã bật chế độ: Ôn toàn bộ 204 từ một lèo! 🔥' : `Đã đặt số từ mỗi phiên: ${btnSize} từ / lượt!`);
      };
    });
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration error:', err));
    }
  },

  route() {
    const rawHash = location.hash.substring(1) || 'dashboard';
    const [pathPart, queryPart] = rawHash.split('?');
    const parts = pathPart.split('/');
    const viewName = parts[0];
    const category = parts[1];
    const value = parts[2] ? decodeURIComponent(parts[2]) : null;

    // Parse URL query params if present
    if (queryPart) {
      const urlParams = new URLSearchParams(queryPart);
      if (urlParams.get('starred') === '1') {
        this.dictParams.starred = true;
      }
    }

    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    const effectiveId = (viewName === 'word-drop') ? 'view-word-drop' : viewName;
    const targetView = document.getElementById(effectiveId);
    if (targetView) {
      targetView.classList.add('active');
      this.currentView = viewName;

      const navBtn = document.getElementById(`nav-${viewName}`);
      if (navBtn) navBtn.classList.add('active');

      if (viewName === 'dashboard') {
        this.initSessionSizeControls();
        this.renderDashboard();
      } else if (viewName === 'reading') {
        this.startReadingSession({ part: 5 });
      } else if (viewName === 'dictionary') {
        this.renderDictionary();
      } else if (viewName === 'flashcard') {
        this.startFlashcardSession({ category, value });
      } else if (viewName === 'quiz') {
        this.startQuizSession({ category, value });
      } else if (viewName === 'game') {
        this.startGameSession({ category, value });
      } else if (viewName === 'cloze') {
        this.startClozeSession();
      } else if (viewName === 'speedtest') {
        this.startSpeedTest();
      } else if (viewName === 'word-drop' || viewName === 'view-word-drop') {
        this.initWordDropView();
      } else if (viewName === 'settings') {
        this.loadSettings();
      }
    }
  },

  bindEvents() {
    // Reset DB data
    document.getElementById('btn-reset-data').addEventListener('click', async () => {
      if (confirm('BẠN CÓ CHẮC CHẮN? Thao tác này sẽ xóa sạch tất cả chủ đề từ vựng, tiến trình học và streak trong database. Không thể hoàn tác.')) {
        try {
          await API.resetAll();
          showToast('Đã xóa sạch mọi dữ liệu trong Database!');
          this.renderDashboard();
        } catch (e) {
          showToast('Không thể xóa dữ liệu: ' + e.message);
        }
      }
    });

    // Dropzone drag-drop implementation for Import
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) this.handleFileImport(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) this.handleFileImport(e.target.files[0]);
      });
    }

    // Submit manual import
    document.getElementById('btn-submit-import').addEventListener('click', async () => {
      const topicName = document.getElementById('import-topic-name').value;
      const content = document.getElementById('import-content').value;

      if (!topicName.trim() || !content.trim()) {
        showToast('Vui lòng nhập đầy đủ tên chủ đề và nội dung từ vựng!');
        return;
      }

      try {
        const res = await API.postImportManual(topicName, content);
        showToast(`Đã nhập thành công ${res.wordCount} từ vựng!`);
        document.getElementById('import-topic-name').value = '';
        document.getElementById('import-content').value = '';
        location.hash = '#dashboard';
      } catch (e) {
        showToast('Lỗi import: ' + e.message);
      }
    });

    // Backup & Export Events
    document.getElementById('btn-export-json').addEventListener('click', () => {
      API.exportBackup();
    });

    const backupDropzone = document.getElementById('backup-dropzone');
    const backupFileInput = document.getElementById('backup-file-input');
    if (backupDropzone && backupFileInput) {
      backupDropzone.addEventListener('click', () => backupFileInput.click());
      backupDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        backupDropzone.classList.add('dragover');
      });
      backupDropzone.addEventListener('dragleave', () => backupDropzone.classList.remove('dragover'));
      backupDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        backupDropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) this.handleBackupRestore(e.dataTransfer.files[0]);
      });
      backupFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) this.handleBackupRestore(e.target.files[0]);
      });
    }

    // Dashboard Tabs Filter Switching
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        const targetTabName = tab.getAttribute('data-tab');
        document.getElementById(`tab-content-${targetTabName}`).classList.add('active');
      });
    });

    // TOEIC Reading Part Tabs & Action Buttons
    ['p5', 'p6', 'p7'].forEach(p => {
      const btn = document.getElementById(`btn-reading-${p}`);
      if (btn) {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.reading-part-tabs .tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const partNum = p === 'p5' ? 5 : p === 'p6' ? 6 : 7;
          this.startReadingSession({ part: partNum });
        });
      }
    });

    const btnReadingSubmit = document.getElementById('btn-reading-submit');
    if (btnReadingSubmit) {
      btnReadingSubmit.addEventListener('click', () => this.submitReadingTest());
    }

    const btnReadingRestart = document.getElementById('btn-reading-restart');
    if (btnReadingRestart) {
      btnReadingRestart.addEventListener('click', () => {
        this.startReadingSession({ part: this.readingState.part });
      });
    }

    // Flashcard Reveal & Rating
    document.getElementById('card-perspective').addEventListener('click', () => this.toggleFlashcardReveal());
    document.getElementById('btn-reveal-card').addEventListener('click', () => this.toggleFlashcardReveal());

    // 4-Level SRS Rating Click Listeners
    document.getElementById('btn-srs-again').addEventListener('click', () => this.gradeFlashcard('again'));
    document.getElementById('btn-srs-hard').addEventListener('click', () => this.gradeFlashcard('hard'));
    document.getElementById('btn-srs-good').addEventListener('click', () => this.gradeFlashcard('good'));
    document.getElementById('btn-srs-easy').addEventListener('click', () => this.gradeFlashcard('easy'));

    // Keyboard Shortcuts for Flashcard Screen (Space = reveal, 1-4 = SRS ratings)
    document.addEventListener('keydown', (e) => {
      if (this.currentView === 'flashcard' && this.sessionWords.length > 0) {
        if (e.code === 'Space') {
          e.preventDefault();
          this.toggleFlashcardReveal();
        } else if (e.key === '1') {
          this.gradeFlashcard('again');
        } else if (e.key === '2') {
          this.gradeFlashcard('hard');
        } else if (e.key === '3') {
          this.gradeFlashcard('good');
        } else if (e.key === '4') {
          this.gradeFlashcard('easy');
        }
      }
    });

    // Dictionary Search & Filters Event Listeners
    const searchInput = document.getElementById('dict-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
          this.dictParams.search = e.target.value;
          this.renderDictionary();
        }, 300);
      });
    }

    const srsFilter = document.getElementById('dict-srs-filter');
    if (srsFilter) {
      srsFilter.addEventListener('change', (e) => {
        this.dictParams.srsLevel = e.target.value;
        this.renderDictionary();
      });
    }

    const starredFilter = document.getElementById('dict-starred-filter');
    if (starredFilter) {
      starredFilter.addEventListener('change', (e) => {
        this.dictParams.starred = e.target.checked;
        this.renderDictionary();
      });
    }

    document.getElementById('btn-dict-refresh').addEventListener('click', () => this.renderDictionary());

    // Edit Modal Buttons
    document.getElementById('btn-modal-cancel').addEventListener('click', () => {
      document.getElementById('modal-edit-word').style.display = 'none';
    });

    document.getElementById('btn-modal-save').addEventListener('click', async () => {
      const wordId = document.getElementById('edit-word-id').value;
      const meaning = document.getElementById('edit-word-meaning').value;
      const example = document.getElementById('edit-word-example').value;
      const notes = document.getElementById('edit-word-notes').value;
      const pos = document.getElementById('edit-word-pos').value;
      const ipa = document.getElementById('edit-word-ipa').value;
      const synonyms = document.getElementById('edit-word-synonyms').value;
      const collocations = document.getElementById('edit-word-collocations').value;
      const word_family = document.getElementById('edit-word-wordfamily').value;

      try {
        await API.putWord(wordId, { meaning, example, notes, pos, ipa, synonyms, collocations, word_family });
        showToast('Đã cập nhật chỉnh sửa từ vựng!');
        document.getElementById('modal-edit-word').style.display = 'none';
        if (this.currentView === 'dictionary') this.renderDictionary();
      } catch (e) {
        showToast('Lỗi cập nhật: ' + e.message);
      }
    });

    // Settings logic
    const toggleKeyBtn = document.getElementById('btn-toggle-key-visibility');
    const keyInput = document.getElementById('settings-gemini-key');

    toggleKeyBtn.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleKeyBtn.innerText = 'Ẩn';
      } else {
        keyInput.type = 'password';
        toggleKeyBtn.innerText = 'Hiện';
      }
    });

    document.getElementById('btn-save-settings').addEventListener('click', async () => {
      const apiKey = keyInput.value.trim();
      try {
        await API.postSettings(apiKey);
        showToast('Đã lưu cài đặt API Key thành công!');
        location.hash = '#dashboard';
      } catch (e) {
        showToast('Lỗi lưu cài đặt: ' + e.message);
      }
    });
  },

  async loadSettings() {
    try {
      const settings = await API.getSettings();
      const keyInput = document.getElementById('settings-gemini-key');
      if (settings.hasApiKey) {
        keyInput.value = '';
        keyInput.placeholder = '•••••••••••••••• (Đã cấu hình Key)';
      } else {
        keyInput.value = '';
        keyInput.placeholder = 'Nhập API Key từ Google AI Studio';
      }
    } catch (e) {
      console.error(e);
    }
  },

  async handleFileImport(file) {
    const dropzone = document.getElementById('dropzone');
    const loading = document.getElementById('upload-loading');

    dropzone.style.display = 'none';
    loading.style.display = 'flex';

    try {
      const res = await API.uploadFile(file);
      let successMsg = `Đã phân tích xong và nhập thành công ${res.wordCount} từ vựng vào chủ đề "${res.topicName}"`;
      if (res.warning) {
        successMsg += `\n(${res.warning})`;
      }
      showToast(successMsg);
      location.hash = '#dashboard';
    } catch (e) {
      showToast('Lỗi tải file / AI parsing: ' + e.message);
    } finally {
      dropzone.style.display = 'block';
      loading.style.display = 'none';
      document.getElementById('file-input').value = '';
    }
  },

  async handleBackupRestore(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        const res = await API.importBackup(backupData);
        showToast(`Khôi phục thành công ${res.wordCount} từ vựng và tiến trình học!`);
        location.hash = '#dashboard';
      } catch (err) {
        showToast('Khôi phục thất bại: ' + err.message);
      }
    };
    reader.readAsText(file);
  },

  // -------------------------------------------------------------
  // DASHBOARD RENDERER & FORECAST WIDGET
  // -------------------------------------------------------------
  async renderDashboard() {
    try {
      const data = await API.getDashboard();

      document.getElementById('stat-total-words').innerText = data.totalWords;
      document.getElementById('stat-active-topics').innerText = `${data.activeTopicsCount} chủ đề đang học`;
      document.getElementById('stat-streak').innerText = `${data.streak} ngày 🔥`;
      document.getElementById('stat-mastered').innerText = data.masteredCount;
      document.getElementById('stat-due').innerText = data.dueCount;

      // Render SRS distribution height charts
      const distribution = data.distribution || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      const maxLevelCount = Math.max(...Object.values(distribution), 1);
      for (let i = 0; i <= 4; i++) {
        const pct = ((distribution[i] || 0) / maxLevelCount) * 100;
        document.getElementById(`srs-bar-${i}`).style.height = `${pct}%`;
        document.getElementById(`srs-bar-${i}`).title = `${distribution[i]} từ`;
      }

      // Render 7-day Review Forecast Widget
      this.renderForecast();

      // Render Topics List
      const topics = await API.getTopics();
      const topicsContainer = document.getElementById('topics-list');
      topicsContainer.innerHTML = '';

      if (topics.length === 0) {
        topicsContainer.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background-color: var(--surface-card); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.05);">
            <p style="color: var(--text-muted); margin-bottom: 1rem;">Bạn chưa nhập chủ đề từ vựng nào.</p>
            <a href="#import" class="btn btn-primary">Bắt đầu tải tài liệu</a>
          </div>
        `;
      } else {
        topics.forEach(topic => {
          const card = document.createElement('div');
          card.className = 'topic-card';
          card.innerHTML = `
            <div>
              <h3 class="topic-title">${escapeHTML(topic.name)}</h3>
              <div class="topic-meta">
                <span class="meta-tag">${topic.word_count} từ</span>
                <span class="meta-tag" style="background-color: rgba(232, 184, 75, 0.05); color: var(--accent-gold);">${escapeHTML(topic.source || 'Manual')}</span>
              </div>
            </div>
            <div class="topic-actions">
              <a href="#flashcard/topic/${topic.id}" class="btn btn-primary">Flashcard</a>
              <a href="#quiz/topic/${topic.id}" class="btn btn-secondary">Quiz</a>
              <a href="#game/topic/${topic.id}" class="btn btn-secondary">Game</a>
            </div>
          `;
          topicsContainer.appendChild(card);
        });
      }

      // Render Specialties List
      const specialtiesContainer = document.getElementById('specialties-list');
      specialtiesContainer.innerHTML = '';
      (data.specialties || []).forEach(spec => {
        const card = document.createElement('div');
        card.className = 'topic-card';
        card.innerHTML = `
          <div>
            <h3 class="topic-title" style="color: var(--accent-teal);">Chuyên ngành: ${escapeHTML(spec.name)}</h3>
            <div class="topic-meta"><span class="meta-tag">${spec.count} thuật ngữ</span></div>
          </div>
          <div class="topic-actions">
            <a href="#flashcard/specialty/${encodeURIComponent(spec.name)}" class="btn btn-primary">Flashcard</a>
            <a href="#quiz/specialty/${encodeURIComponent(spec.name)}" class="btn btn-secondary">Quiz</a>
            <a href="#game/specialty/${encodeURIComponent(spec.name)}" class="btn btn-secondary">Game</a>
          </div>
        `;
        specialtiesContainer.appendChild(card);
      });

      // Render Contexts List
      const contextsContainer = document.getElementById('contexts-list');
      contextsContainer.innerHTML = '';
      (data.contexts || []).forEach(ctx => {
        const card = document.createElement('div');
        card.className = 'topic-card';
        card.innerHTML = `
          <div>
            <h3 class="topic-title" style="color: var(--accent-gold);">Ngữ cảnh: ${escapeHTML(ctx.name)}</h3>
            <div class="topic-meta"><span class="meta-tag">${ctx.count} từ vựng</span></div>
          </div>
          <div class="topic-actions">
            <a href="#flashcard/context/${encodeURIComponent(ctx.name)}" class="btn btn-primary">Flashcard</a>
            <a href="#quiz/context/${encodeURIComponent(ctx.name)}" class="btn btn-secondary">Quiz</a>
            <a href="#game/context/${encodeURIComponent(ctx.name)}" class="btn btn-secondary">Game</a>
          </div>
        `;
        contextsContainer.appendChild(card);
      });

    } catch (error) {
      console.error(error);
      showToast('Lỗi tải dữ liệu Dashboard từ Server.');
    }
  },

  async renderForecast() {
    try {
      const forecast = await API.getForecast();
      const forecastContainer = document.getElementById('forecast-list');
      forecastContainer.innerHTML = '';

      const maxCount = Math.max(...forecast.map(f => f.count), 1);

      forecast.forEach((item, idx) => {
        const col = document.createElement('div');
        col.className = 'forecast-bar-col';
        const heightPct = Math.max(10, Math.round((item.count / maxCount) * 100));

        col.innerHTML = `
          <div class="forecast-count">${item.count}</div>
          <div class="forecast-bar ${idx === 0 ? 'today' : ''}" style="height: ${heightPct}%;"></div>
          <div class="forecast-day">${item.dayLabel}</div>
        `;
        forecastContainer.appendChild(col);
      });
    } catch (e) {
      console.error("Forecast err:", e);
    }
  },

  // -------------------------------------------------------------
  // DICTIONARY CONTROLLER
  // -------------------------------------------------------------
  async renderDictionary() {
    try {
      const alphabetBar = document.getElementById('dict-alphabet-bar');
      if (alphabetBar && alphabetBar.children.length <= 1) {
        alphabetBar.innerHTML = `<button class="letter-btn ${this.dictParams.letter === '' ? 'active' : ''}" onclick="App.filterByLetter('')">ALL</button>`;
        for (let i = 65; i <= 90; i++) {
          const char = String.fromCharCode(i);
          const btn = document.createElement('button');
          btn.className = `letter-btn ${this.dictParams.letter === char ? 'active' : ''}`;
          btn.innerText = char;
          btn.onclick = () => this.filterByLetter(char);
          alphabetBar.appendChild(btn);
        }
      }

      document.getElementById('dict-starred-filter').checked = this.dictParams.starred;

      const words = await API.getDictionary(this.dictParams);
      const container = document.getElementById('dict-words-list');
      container.innerHTML = '';

      if (words.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
            Không tìm thấy từ vựng nào khớp với bộ lọc.
          </div>
        `;
        return;
      }

      words.forEach(w => {
        const card = document.createElement('div');
        card.className = 'dict-word-card';

        const srsColor = getComputedStyle(document.documentElement).getPropertyValue(`--srs-${w.srsLevel || 0}`).trim();

        card.innerHTML = `
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div class="dict-word-term">
                <span>${escapeHTML(w.term)}</span>
                ${w.pos ? `<span class="word-badge" style="background-color: rgba(232, 184, 75, 0.2); color: var(--accent-gold); font-size: 0.75rem;">[${escapeHTML(w.pos)}]</span>` : ''}
                <span class="word-badge" style="background-color: ${srsColor}; color: #12161A;">Lvl ${w.srsLevel}</span>
              </div>
              <button class="star-btn ${w.starred ? 'starred' : ''}" onclick="App.toggleWordStar('${w.id}')" title="Đánh dấu từ hay quên">⭐</button>
            </div>
            ${w.ipa ? `<div style="font-family: var(--font-mono); color: var(--accent-teal); font-size: 0.9rem; margin-top: 2px;">${escapeHTML(w.ipa)}</div>` : ''}
            <div class="dict-word-meaning">${escapeHTML(w.meaning)}</div>

            ${(w.synonyms || w.collocations || w.word_family) ? `
              <div style="font-size: 0.8rem; background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: 6px; margin: 8px 0;">
                ${w.synonyms ? `<div style="color: #63b3ed;">🔗 <strong>Đồng nghĩa:</strong> ${escapeHTML(w.synonyms)}</div>` : ''}
                ${w.collocations ? `<div style="color: #68d391;">📌 <strong>Collocation:</strong> ${escapeHTML(w.collocations)}</div>` : ''}
                ${w.word_family ? `<div style="color: #f6ad55;">🌳 <strong>Họ từ:</strong> ${escapeHTML(w.word_family)}</div>` : ''}
              </div>
            ` : ''}

            ${w.example ? `<div class="dict-word-example">"${escapeHTML(w.example)}"` : ''}
            ${w.notes ? `<div class="dict-word-notes">📝 Ghi chú: ${escapeHTML(w.notes)}</div>` : ''}
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">
              <span>CN: ${escapeHTML(w.specialty || 'Chung')}</span> | <span>NC: ${escapeHTML(w.context || 'Chung')}</span>
            </div>
          </div>
          <div style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem; text-align: right;">
            <button class="btn btn-secondary" style="padding: 0.2rem 0.6rem; font-size: 0.8rem;" onclick="App.openEditWordModal('${w.id}')">✏️ Sửa</button>
          </div>
        `;
        container.appendChild(card);
      });
    } catch (e) {
      showToast('Lỗi tải từ điển: ' + e.message);
    }
  },

  filterByLetter(letter) {
    this.dictParams.letter = letter;
    document.querySelectorAll('.letter-btn').forEach(btn => {
      if (btn.innerText === (letter || 'ALL')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    this.renderDictionary();
  },

  async toggleWordStar(wordId) {
    try {
      const res = await API.postStar(wordId);
      showToast(res.starred ? 'Đã đánh dấu từ vựng hay quên ⭐' : 'Đã bỏ đánh dấu ⭐');
      if (this.currentView === 'dictionary') this.renderDictionary();
    } catch (e) {
      showToast('Lỗi: ' + e.message);
    }
  },

  async openEditWordModal(id) {
    try {
      const words = await API.getDictionary({ search: '', limit: 1000 });
      const w = words.find(item => item.id === id);
      if (!w) return;

      document.getElementById('edit-word-id').value = w.id;
      document.getElementById('edit-word-term').value = w.term || '';
      document.getElementById('edit-word-meaning').value = w.meaning || '';
      document.getElementById('edit-word-example').value = w.example || '';
      document.getElementById('edit-word-notes').value = w.notes || '';
      document.getElementById('edit-word-pos').value = w.pos || '';
      document.getElementById('edit-word-ipa').value = w.ipa || '';
      document.getElementById('edit-word-synonyms').value = w.synonyms || '';
      document.getElementById('edit-word-collocations').value = w.collocations || '';
      document.getElementById('edit-word-wordfamily').value = w.word_family || '';

      document.getElementById('modal-edit-word').style.display = 'flex';
    } catch (e) {
      console.error(e);
    }
  },

  // -------------------------------------------------------------
  // FLASHCARD FLOW (4-LEVEL SRS RATING)
  // -------------------------------------------------------------
  async startFlashcardSession({ category, value, limit } = {}) {
    try {
      this.lastSessionContext = { category, value, type: 'flashcard' };
      const sessionLimit = limit || this.sessionSize || 20;
      this.sessionWords = await API.getReviewSession({ category, value, limit: sessionLimit });
      this.currentWordIndex = 0;
      this.sessionResults = { correct: 0, incorrect: 0, reviewedIds: [] };

      if (this.sessionWords.length === 0) {
        showToast('Nhóm từ này không còn từ nào cần ôn tập hôm nay!');
        location.hash = '#dashboard';
        return;
      }

      this.renderFlashcard();
    } catch (e) {
      showToast('Lỗi khởi tạo phiên Flashcard: ' + e.message);
      location.hash = '#dashboard';
    }
  },

  renderFlashcard() {
    const perspective = document.getElementById('card-perspective');
    perspective.classList.remove('flipped');

    document.getElementById('flashcard-actions-hint').style.display = 'block';
    document.getElementById('flashcard-actions-grade').style.display = 'none';

    const word = this.sessionWords[this.currentWordIndex];

    const total = this.sessionWords.length;
    const current = this.currentWordIndex + 1;
    document.getElementById('flashcard-counter').innerText = `${current}/${total}`;
    document.getElementById('flashcard-progress-bar').style.width = `${(current / total) * 100}%`;

    document.getElementById('card-front-term').innerText = word.term;

    const posEl = document.getElementById('card-front-pos');
    if (posEl) {
      posEl.innerText = word.pos ? `[${word.pos}]` : '';
      posEl.style.display = word.pos ? 'inline-block' : 'none';
    }

    const ipaEl = document.getElementById('card-front-ipa');
    if (ipaEl) {
      ipaEl.innerText = word.ipa || '';
      ipaEl.style.display = word.ipa ? 'block' : 'none';
    }

    document.getElementById('card-back-meaning').innerText = word.meaning;
    document.getElementById('card-back-specialty').innerText = word.specialty || 'Chung';
    document.getElementById('card-back-context').innerText = word.context || 'Chung';
    document.getElementById('card-back-example').innerText = word.example || 'Không có ví dụ';

    const synArea = document.getElementById('card-back-synonyms-area');
    if (synArea) synArea.innerHTML = word.synonyms ? `🔗 <strong>Đồng nghĩa:</strong> ${escapeHTML(word.synonyms)}` : '';

    const colArea = document.getElementById('card-back-collocations-area');
    if (colArea) colArea.innerHTML = word.collocations ? `📌 <strong>Collocations:</strong> ${escapeHTML(word.collocations)}` : '';

    const wfArea = document.getElementById('card-back-wordfamily-area');
    if (wfArea) wfArea.innerHTML = word.word_family ? `🌳 <strong>Họ từ:</strong> ${escapeHTML(word.word_family)}` : '';

    const notesArea = document.getElementById('card-back-notes-area');
    if (notesArea) {
      notesArea.innerText = word.notes ? `📝 Ghi chú: ${word.notes}` : '';
    }

    const badgeContainer = document.getElementById('card-front-badge-container');
    badgeContainer.innerHTML = '';
    if (word.sessionType) {
      const badge = document.createElement('span');
      badge.className = `word-badge ${word.sessionType === 'NEW' ? 'badge-new' : word.sessionType === 'DUE' ? 'badge-due' : 'badge-review'}`;
      badge.innerText = word.sessionType === 'NEW' ? 'Mới' : word.sessionType === 'DUE' ? 'Đến hạn' : 'Gối đầu';
      badgeContainer.appendChild(badge);
    }

    const srsColor = getComputedStyle(document.documentElement).getPropertyValue(`--srs-${word.srsLevel || 0}`).trim();
    document.getElementById('card-front-dogear').style.setProperty('--srs-level-color', srsColor);
    document.getElementById('card-back-dogear').style.setProperty('--srs-level-color', srsColor);
  },

  toggleFlashcardReveal() {
    const perspective = document.getElementById('card-perspective');
    if (!perspective.classList.contains('flipped')) {
      perspective.classList.add('flipped');
      document.getElementById('flashcard-actions-hint').style.display = 'none';
      document.getElementById('flashcard-actions-grade').style.display = 'grid';
    }
  },

  async gradeFlashcard(rating) {
    const word = this.sessionWords[this.currentWordIndex];
    const isCorrect = (rating === 'good' || rating === 'easy');

    try {
      const result = await API.postReview(word.id, { rating });

      if (isCorrect) {
        this.sessionResults.correct++;
      } else {
        this.sessionResults.incorrect++;
      }
      this.sessionResults.reviewedIds.push(word.id);

      this.currentWordIndex++;
      if (this.currentWordIndex >= this.sessionWords.length) {
        this.showSessionSummary(result.streak);
      } else {
        this.renderFlashcard();
      }
    } catch (e) {
      showToast('Không lưu được kết quả ôn tập: ' + e.message);
    }
  },

  // -------------------------------------------------------------
  // CLOZE TEST CONTROLLER (NGỮ CẢNH / PART 5)
  // -------------------------------------------------------------
  async startClozeSession() {
    try {
      this.clozeQuestions = await API.getClozeSession(15);
      this.clozeCurrentIndex = 0;
      this.sessionResults = { correct: 0, incorrect: 0, reviewedIds: [] };

      if (this.clozeQuestions.length === 0) {
        showToast('Chưa có câu ví dụ nào trong cơ sở dữ liệu để tạo Cloze Test!');
        location.hash = '#dashboard';
        return;
      }

      this.renderClozeQuestion();
    } catch (e) {
      showToast('Lỗi tạo bài tập điền từ: ' + e.message);
      location.hash = '#dashboard';
    }
  },

  renderClozeQuestion() {
    document.getElementById('btn-cloze-next').style.display = 'none';

    const q = this.clozeQuestions[this.clozeCurrentIndex];
    const total = this.clozeQuestions.length;
    const current = this.clozeCurrentIndex + 1;

    document.getElementById('cloze-counter').innerText = `${current}/${total}`;
    document.getElementById('cloze-progress-bar').style.width = `${(current / total) * 100}%`;

    document.getElementById('cloze-sentence').innerHTML = escapeHTML(q.maskedSentence).replace('_______', `<span style="color: var(--accent-gold); border-bottom: 2px dashed var(--accent-gold); padding: 0 8px;">_______</span>`);
    document.getElementById('cloze-translation').innerText = q.vietnameseTranslation ? `(${q.vietnameseTranslation})` : '';

    const optionsContainer = document.getElementById('cloze-options');
    optionsContainer.innerHTML = '';

    q.options.forEach((optText, index) => {
      const btn = document.createElement('div');
      btn.className = 'quiz-option';
      btn.innerHTML = `
        <span>
          <span class="quiz-option-letter">${String.fromCharCode(65 + index)}</span>
          <span>${escapeHTML(optText)}</span>
        </span>
      `;
      btn.addEventListener('click', () => this.handleClozeAnswer(btn, optText, q.correctTerm));
      optionsContainer.appendChild(btn);
    });
  },

  async handleClozeAnswer(selectedOptionEl, chosenText, correctText) {
    const options = document.querySelectorAll('#cloze-options .quiz-option');
    options.forEach(opt => opt.style.pointerEvents = 'none');

    const isCorrect = (chosenText.toLowerCase() === correctText.toLowerCase());
    const q = this.clozeQuestions[this.clozeCurrentIndex];

    options.forEach(opt => {
      const text = opt.querySelector('span span:nth-child(2)').innerText;
      if (text.toLowerCase() === correctText.toLowerCase()) {
        opt.classList.add('correct');
      } else if (opt === selectedOptionEl && !isCorrect) {
        opt.classList.add('incorrect');
      }
    });

    try {
      const result = await API.postReview(q.id, isCorrect);
      if (isCorrect) this.sessionResults.correct++;
      else this.sessionResults.incorrect++;

      const nextBtn = document.getElementById('btn-cloze-next');
      nextBtn.style.display = 'block';
      nextBtn.onclick = () => {
        this.clozeCurrentIndex++;
        if (this.clozeCurrentIndex >= this.clozeQuestions.length) {
          this.showSessionSummary(result.streak);
        } else {
          this.renderClozeQuestion();
        }
      };
    } catch (e) {
      console.error(e);
    }
  },

  // -------------------------------------------------------------
  // SPEED TEST CONTROLLER (20 TỪ / 60 GIÂY)
  // -------------------------------------------------------------
  async startSpeedTest() {
    try {
      const rawWords = await API.getReviewSession({ limit: 20 });
      if (rawWords.length < 5) {
        showToast('Cần ít nhất 5 từ vựng để thử thách Trắc nghiệm Tốc độ!');
        location.hash = '#dashboard';
        return;
      }

      this.speedQuestions = rawWords;
      shuffle(this.speedQuestions);
      this.speedCurrentIndex = 0;
      this.speedScore = 0;
      this.speedTimeLeft = 60;

      document.getElementById('speed-score-val').innerText = this.speedScore;
      document.getElementById('speed-timer-val').innerText = `${this.speedTimeLeft}s`;

      clearInterval(this.speedTimer);
      this.speedTimer = setInterval(() => {
        this.speedTimeLeft--;
        document.getElementById('speed-timer-val').innerText = `${this.speedTimeLeft}s`;
        if (this.speedTimeLeft <= 0) {
          clearInterval(this.speedTimer);
          showToast('Hết giờ Speed Test!');
          this.showSessionSummary(0);
        }
      }, 1000);

      this.renderSpeedQuestion();
    } catch (e) {
      showToast('Lỗi khởi tạo Speed Test: ' + e.message);
      location.hash = '#dashboard';
    }
  },

  renderSpeedQuestion() {
    if (this.speedCurrentIndex >= this.speedQuestions.length || this.speedTimeLeft <= 0) {
      clearInterval(this.speedTimer);
      this.showSessionSummary(0);
      return;
    }

    const word = this.speedQuestions[this.speedCurrentIndex];
    document.getElementById('speed-term').innerText = word.term;

    const options = [word.meaning];
    const pool = this.speedQuestions.filter(w => w.meaning !== word.meaning);
    shuffle(pool);

    for (let i = 0; i < Math.min(3, pool.length); i++) {
      options.push(pool[i].meaning);
    }
    while (options.length < 4) options.push(`Đáp án nhiễu #${options.length}`);
    shuffle(options);

    const optionsContainer = document.getElementById('speed-options');
    optionsContainer.innerHTML = '';

    options.forEach((optText, index) => {
      const btn = document.createElement('div');
      btn.className = 'quiz-option';
      btn.innerHTML = `
        <span>
          <span class="quiz-option-letter">${String.fromCharCode(65 + index)}</span>
          <span>${escapeHTML(optText)}</span>
        </span>
      `;
      btn.addEventListener('click', () => this.handleSpeedAnswer(word.id, optText === word.meaning));
      optionsContainer.appendChild(btn);
    });
  },

  async handleSpeedAnswer(wordId, isCorrect) {
    if (isCorrect) {
      this.speedScore += 10;
      this.sessionResults.correct++;
    } else {
      this.sessionResults.incorrect++;
    }
    document.getElementById('speed-score-val').innerText = this.speedScore;

    API.postReview(wordId, isCorrect).catch(() => {});

    this.speedCurrentIndex++;
    this.renderSpeedQuestion();
  },

  // -------------------------------------------------------------
  // QUIZ FLOW
  // -------------------------------------------------------------
  quizContextMode: false,       // false = translation mode, true = context/cloze mode
  quizWrongIds: new Set(),      // track wrong-answered word IDs in session
  quizAnsweredCount: 0,         // total questions answered (including re-queued)
  quizCorrectCount: 0,          // correct answers (including re-queued)
  quizOriginalLength: 0,        // original word count before re-queues

  async startQuizSession({ category, value, limit } = {}) {
    try {
      this.lastSessionContext = { category, value, type: 'quiz' };
      const sessionLimit = limit || this.sessionSize || 20;
      this.sessionWords = await API.getReviewSession({ category, value, limit: sessionLimit });
      this.currentWordIndex = 0;
      this.sessionResults = { correct: 0, incorrect: 0, reviewedIds: [] };
      this.quizWrongIds = new Set();
      this.quizAnsweredCount = 0;
      this.quizCorrectCount = 0;
      this.quizOriginalLength = this.sessionWords.length;

      if (this.sessionWords.length === 0) {
        showToast('Nhóm từ này không còn từ nào cần ôn tập hôm nay!');
        location.hash = '#dashboard';
        return;
      }

      // Build distractor pool: wider fetch for smart distractor selection
      const tempSession = await API.getReviewSession({ limit: 200 });
      this.quizDistractorPool = tempSession.length > 5 ? tempSession : this.sessionWords;

      // Set up mode toggle button
      const modeBtn = document.getElementById('btn-quiz-mode');
      modeBtn.onclick = () => this.toggleQuizMode();
      this.updateQuizModeUI();

      // Reset accuracy badge
      const badge = document.getElementById('quiz-accuracy-badge');
      badge.style.display = 'none';
      badge.className = 'quiz-accuracy-badge';

      this.renderQuizQuestion();
    } catch (e) {
      showToast('Lỗi khởi tạo phiên Quiz: ' + e.message);
      location.hash = '#dashboard';
    }
  },

  toggleQuizMode() {
    this.quizContextMode = !this.quizContextMode;
    this.updateQuizModeUI();
    // Re-render current question with new mode
    this.renderQuizQuestion();
  },

  updateQuizModeUI() {
    const modeBtn = document.getElementById('btn-quiz-mode');
    const modeIcon = document.getElementById('quiz-mode-icon');
    const modeLabel = document.getElementById('quiz-mode-label');
    if (this.quizContextMode) {
      modeBtn.classList.add('context-mode');
      modeIcon.innerText = '📖';
      modeLabel.innerText = 'Chế độ: Ngữ cảnh';
    } else {
      modeBtn.classList.remove('context-mode');
      modeIcon.innerText = '📝';
      modeLabel.innerText = 'Chế độ: Dịch thuật';
    }
  },

  updateQuizAccuracy() {
    if (this.quizAnsweredCount === 0) return;
    const pct = Math.round((this.quizCorrectCount / this.quizAnsweredCount) * 100);
    const badge = document.getElementById('quiz-accuracy-badge');
    const val = document.getElementById('quiz-accuracy-val');
    badge.style.display = 'flex';
    val.innerText = `${pct}%`;
    badge.className = 'quiz-accuracy-badge';
    if (pct >= 80) badge.classList.add('high');
    else if (pct >= 55) badge.classList.add('mid');
    else badge.classList.add('low');
  },

  // Build smart distractors: same POS preferred, then same topic, then random
  buildSmartDistractors(correctWord, count = 3) {
    const pool = this.quizDistractorPool.filter(w =>
      w.meaning !== correctWord.meaning && w.id !== correctWord.id
    );

    // Tier 1: same POS + same topic
    const tier1 = pool.filter(w =>
      w.pos && correctWord.pos && w.pos === correctWord.pos &&
      w.topic_id && correctWord.topic_id && w.topic_id === correctWord.topic_id
    );
    // Tier 2: same POS only
    const tier2 = pool.filter(w =>
      w.pos && correctWord.pos && w.pos === correctWord.pos &&
      !(tier1.find(x => x.id === w.id))
    );
    // Tier 3: same topic only
    const tier3 = pool.filter(w =>
      w.topic_id && correctWord.topic_id && w.topic_id === correctWord.topic_id &&
      !(tier1.find(x => x.id === w.id)) &&
      !(tier2.find(x => x.id === w.id))
    );
    // Tier 4: anything else
    const tier4 = pool.filter(w =>
      !(tier1.find(x => x.id === w.id)) &&
      !(tier2.find(x => x.id === w.id)) &&
      !(tier3.find(x => x.id === w.id))
    );

    shuffle(tier1); shuffle(tier2); shuffle(tier3); shuffle(tier4);
    const combined = [...tier1, ...tier2, ...tier3, ...tier4];
    return combined.slice(0, count).map(w => w.meaning);
  },

  // Build context sentence with the term replaced by ______
  buildContextSentence(word) {
    if (!word.example) return null;
    const term = word.term;
    // Try to mask the term (case-insensitive) in the example
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (!regex.test(word.example)) return null; // term not found in example
    return word.example.replace(regex, `<span class="quiz-context-blank">_______</span>`);
  },

  renderQuizQuestion() {
    document.getElementById('btn-quiz-next').style.display = 'none';
    document.getElementById('quiz-explanation-panel').style.display = 'none';

    const word = this.sessionWords[this.currentWordIndex];

    // Counter shows original progress (ignore re-queued words beyond original count)
    const displayIndex = Math.min(this.currentWordIndex + 1, this.quizOriginalLength);
    const total = this.quizOriginalLength;
    document.getElementById('quiz-counter').innerText = `${displayIndex}/${total}`;
    document.getElementById('quiz-progress-bar').style.width =
      `${(displayIndex / total) * 100}%`;

    // Session type badge
    const badgeContainer = document.getElementById('quiz-badge-container');
    badgeContainer.innerHTML = '';
    if (word.sessionType) {
      const badge = document.createElement('span');
      badge.className = `word-badge ${word.sessionType === 'NEW' ? 'badge-new' : word.sessionType === 'DUE' ? 'badge-due' : 'badge-review'}`;
      badge.innerText = word.sessionType === 'NEW' ? 'Mới' : word.sessionType === 'DUE' ? 'Đến Hạn' : 'Gối Đầu';
      badgeContainer.appendChild(badge);
    }
    // Add "Ôn lại" badge for re-queued wrong words
    if (this.quizWrongIds.has(word.id) && this.currentWordIndex >= this.quizOriginalLength) {
      const reBadge = document.createElement('span');
      reBadge.className = 'word-badge badge-due';
      reBadge.style.marginLeft = '4px';
      reBadge.innerText = '🔁 Ôn lại';
      badgeContainer.appendChild(reBadge);
    }

    // Decide question display mode
    const termEl = document.getElementById('quiz-question-word');
    const ctxEl = document.getElementById('quiz-context-sentence');
    const hintEl = document.getElementById('quiz-question-hint');

    const contextHtml = this.quizContextMode ? this.buildContextSentence(word) : null;

    if (this.quizContextMode && contextHtml) {
      termEl.style.display = 'none';
      ctxEl.style.display = 'block';
      ctxEl.innerHTML = contextHtml;
      hintEl.innerText = 'Chọn nghĩa của từ bị che (______) trong câu trên:';
    } else {
      termEl.style.display = 'block';
      termEl.innerText = word.term;
      ctxEl.style.display = 'none';
      hintEl.innerText = this.quizContextMode
        ? 'Không có câu ví dụ — chọn nghĩa đúng của từ này:'
        : 'Hãy chọn định nghĩa chính xác nhất của từ này:';
    }

    // Build options
    const correctMeaning = word.meaning;
    const distractors = this.buildSmartDistractors(word, 3);
    const options = [correctMeaning, ...distractors];
    while (options.length < 4) options.push(`Đáp án nhiễu #${options.length}`);
    shuffle(options);

    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';
    options.forEach((optText, index) => {
      const btn = document.createElement('div');
      btn.className = 'quiz-option';
      btn.innerHTML = `
        <span>
          <span class="quiz-option-letter">${String.fromCharCode(65 + index)}</span>
          <span>${escapeHTML(optText)}</span>
        </span>
      `;
      btn.addEventListener('click', () => this.handleQuizAnswer(btn, optText, correctMeaning, word));
      optionsContainer.appendChild(btn);
    });
  },

  async handleQuizAnswer(selectedOptionEl, chosenText, correctText, word) {
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(opt => opt.style.pointerEvents = 'none');

    const isCorrect = (chosenText === correctText);
    this.quizAnsweredCount++;
    if (isCorrect) this.quizCorrectCount++;
    this.updateQuizAccuracy();

    // Highlight correct/wrong options
    options.forEach(opt => {
      const text = opt.querySelector('span span:nth-child(2)').innerText;
      if (text === correctText) {
        opt.classList.add('correct');
      } else if (opt === selectedOptionEl && !isCorrect) {
        opt.classList.add('incorrect');
      }
    });

    // Update SRS via API
    try {
      const result = await API.postReview(word.id, isCorrect);

      if (isCorrect) {
        this.sessionResults.correct++;
      } else {
        this.sessionResults.incorrect++;
        // Leitner re-queue: add wrong word back to end of session if not already
        if (!this.quizWrongIds.has(word.id)) {
          this.quizWrongIds.add(word.id);
          this.sessionWords.push({ ...word, sessionType: 'REVIEW' });
        }
      }
      this.sessionResults.reviewedIds.push(word.id);

      // Show explanation panel
      this.showQuizExplanation(word, isCorrect, correctText);

      const nextBtn = document.getElementById('btn-quiz-next');
      nextBtn.style.display = 'block';
      nextBtn.onclick = () => {
        this.currentWordIndex++;
        if (this.currentWordIndex >= this.sessionWords.length) {
          this.showSessionSummary(result.streak);
        } else {
          this.renderQuizQuestion();
        }
      };
    } catch (e) {
      showToast('Lỗi ghi tiến trình quiz: ' + e.message);
    }
  },

  showQuizExplanation(word, isCorrect, correctText) {
    const panel = document.getElementById('quiz-explanation-panel');
    const correctEl = document.getElementById('quiz-exp-correct-answer');
    const ctxEl = document.getElementById('quiz-exp-context');
    const posEl = document.getElementById('quiz-exp-pos');
    const requeueEl = document.getElementById('quiz-exp-requeueed');

    // Correct answer line
    if (isCorrect) {
      correctEl.innerHTML = `✅ Chính xác! <strong>${escapeHTML(word.term)}</strong> = ${escapeHTML(correctText)}`;
      correctEl.style.borderLeftColor = 'var(--accent-teal)';
      correctEl.style.background = 'rgba(79, 189, 186, 0.1)';
    } else {
      correctEl.innerHTML = `❌ Đáp án đúng: <strong>${escapeHTML(word.term)}</strong> = ${escapeHTML(correctText)}`;
      correctEl.style.borderLeftColor = 'var(--accent-coral)';
      correctEl.style.background = 'rgba(232, 98, 61, 0.08)';
    }

    // Example sentence with term highlighted
    if (word.example) {
      const highlightedEx = word.example.replace(
        new RegExp(word.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        m => `<span class="highlight-term">${escapeHTML(m)}</span>`
      );
      ctxEl.innerHTML = `📖 <em>${highlightedEx}</em>`;
      ctxEl.style.display = 'block';
    } else {
      ctxEl.style.display = 'none';
    }

    // POS + topic info
    const parts = [];
    if (word.pos) parts.push(`<span class="pos-tag">${escapeHTML(word.pos)}</span>`);
    if (word.specialty) parts.push(`Chuyên ngành: <em>${escapeHTML(word.specialty)}</em>`);
    if (word.context) parts.push(`Hoàn cảnh: <em>${escapeHTML(word.context)}</em>`);
    posEl.innerHTML = parts.join(' &nbsp;·&nbsp; ');
    posEl.style.display = parts.length ? 'flex' : 'none';

    // Re-queue notice
    if (!isCorrect && this.quizWrongIds.has(word.id)) {
      requeueEl.style.display = 'block';
    } else {
      requeueEl.style.display = 'none';
    }

    panel.style.display = 'flex';
  },

  // -------------------------------------------------------------
  // MATCHING GAME FLOW
  // -------------------------------------------------------------
  async startGameSession({ category, value }) {
    try {
      let rawWords = [];
      if (category === 'topic') {
        rawWords = await API.getWordsByTopic(value);
      } else if (category === 'specialty') {
        rawWords = await API.getWordsBySpecialty(value);
      } else if (category === 'context') {
        rawWords = await API.getWordsByContext(value);
      } else {
        rawWords = await API.getReviewSession({ limit: 12 });
      }

      if (rawWords.length < 3) {
        showToast('Cần ít nhất 3 từ vựng trong nhóm này để chơi game ghép cặp!');
        location.hash = '#dashboard';
        return;
      }

      const gameWords = rawWords.slice(0, 8);

      this.gameScore = 0;
      this.timeLeft = 60;
      document.getElementById('game-score-val').innerText = this.gameScore;
      document.getElementById('game-timer-val').innerText = `${this.timeLeft}s`;

      const cards = [];
      gameWords.forEach(w => {
        cards.push({ id: w.id, text: w.term, type: 'term', matchId: w.id });
        cards.push({ id: w.id + '_meaning', text: w.meaning, type: 'meaning', matchId: w.id });
      });

      shuffle(cards);
      this.matchingCards = cards;
      this.selectedMatchingCard = null;

      clearInterval(this.gameTimer);
      this.gameTimer = setInterval(async () => {
        this.timeLeft--;
        document.getElementById('game-timer-val').innerText = `${this.timeLeft}s`;

        if (this.timeLeft <= 0) {
          clearInterval(this.gameTimer);
          showToast('Hết giờ rồi!');
          await this.showGameResults();
        }
      }, 1000);

      this.renderGameGrid();
    } catch (e) {
      showToast('Lỗi khởi động game: ' + e.message);
      location.hash = '#dashboard';
    }
  },

  renderGameGrid() {
    const grid = document.getElementById('game-grid');
    grid.innerHTML = '';

    this.matchingCards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'matching-card';
      cardEl.innerText = card.text;

      if (card.matched) cardEl.classList.add('matched');

      cardEl.addEventListener('click', () => this.handleCardSelect(card, cardEl));
      grid.appendChild(cardEl);
    });
  },

  async handleCardSelect(card, cardEl) {
    if (card.matched) return;

    document.querySelectorAll('.matching-card.wrong').forEach(el => el.classList.remove('wrong'));

    if (!this.selectedMatchingCard) {
      this.selectedMatchingCard = { card, el: cardEl };
      cardEl.classList.add('selected');
    } else {
      const first = this.selectedMatchingCard;

      if (first.card.id === card.id) {
        first.el.classList.remove('selected');
        this.selectedMatchingCard = null;
        return;
      }

      if (first.card.matchId === card.matchId && first.card.type !== card.type) {
        first.card.matched = true;
        card.matched = true;

        first.el.classList.remove('selected');
        first.el.classList.add('matched');
        cardEl.classList.add('matched');

        this.gameScore++;
        document.getElementById('game-score-val').innerText = this.gameScore;
        this.selectedMatchingCard = null;

        API.postReview(card.matchId, true).catch(console.error);

        if (this.matchingCards.every(c => c.matched)) {
          clearInterval(this.gameTimer);
          showToast('Xuất sắc! Đã ghép đúng toàn bộ.');
          setTimeout(() => this.showGameResults(), 800);
        }
      } else {
        first.el.classList.remove('selected');
        first.el.classList.add('wrong');
        cardEl.classList.add('wrong');

        this.selectedMatchingCard = null;

        API.postReview(card.matchId, false).catch(console.error);
        API.postReview(first.card.matchId, false).catch(console.error);

        setTimeout(() => {
          first.el.classList.remove('wrong');
          cardEl.classList.remove('wrong');
        }, 600);
      }
    }
  },

  async showGameResults() {
    clearInterval(this.gameTimer);
    try {
      const stats = await API.getDashboard();

      document.getElementById('results-headline').innerText = 'Kết quả chơi Game!';
      document.getElementById('results-subheadline').innerText = `Bạn đã ghép đúng ${this.gameScore} cặp từ`;
      document.getElementById('results-correct-ratio').innerText = `${this.gameScore > 0 ? 100 : 0}%`;

      document.getElementById('results-total-reviewed').innerText = this.gameScore;
      document.getElementById('results-correct-count').innerText = this.gameScore;
      document.getElementById('results-incorrect-count').innerText = 0;
      document.getElementById('results-streak-val').innerText = `${stats.streak} ngày 🔥`;

      location.hash = '#results';
    } catch (e) {
      console.error(e);
      location.hash = '#dashboard';
    }
  },

  showSessionSummary(streakVal) {
    const total = this.sessionResults.correct + this.sessionResults.incorrect;
    const accuracy = total > 0 ? Math.round((this.sessionResults.correct / total) * 100) : 0;

    document.getElementById('results-headline').innerText = 'Đã hoàn thành phiên!';
    document.getElementById('results-subheadline').innerText = 'Tiến trình học đã được lưu vào cơ sở dữ liệu';
    document.getElementById('results-correct-ratio').innerText = `${accuracy}%`;

    document.getElementById('results-total-reviewed').innerText = total;
    document.getElementById('results-correct-count').innerText = this.sessionResults.correct;
    document.getElementById('results-incorrect-count').innerText = this.sessionResults.incorrect;
    document.getElementById('results-streak-val').innerText = `${streakVal} ngày 🔥`;

    // Action buttons on results screen
    const btnContinue = document.getElementById('btn-results-continue');
    if (btnContinue) {
      btnContinue.onclick = () => {
        const last = this.lastSessionContext || { category: 'topic', value: 't_part5' };
        if (last.type === 'quiz') {
          this.startQuizSession(last);
          location.hash = `#quiz/${last.category || 'topic'}/${encodeURIComponent(last.value || 't_part5')}`;
        } else {
          this.startFlashcardSession(last);
          location.hash = `#flashcard/${last.category || 'topic'}/${encodeURIComponent(last.value || 't_part5')}`;
        }
      };
    }

    const btnAll = document.getElementById('btn-results-all');
    if (btnAll) {
      btnAll.onclick = () => {
        const last = this.lastSessionContext || { category: 'topic', value: 't_part5' };
        if (last.type === 'quiz') {
          this.startQuizSession({ ...last, limit: 300 });
          location.hash = `#quiz/${last.category || 'topic'}/${encodeURIComponent(last.value || 't_part5')}`;
        } else {
          this.startFlashcardSession({ ...last, limit: 300 });
          location.hash = `#flashcard/${last.category || 'topic'}/${encodeURIComponent(last.value || 't_part5')}`;
        }
      };
    }

    location.hash = '#results';
  },

  // -------------------------------------------------------------
  // TOEIC READING MODULE (PART 5, 6, 7 & PROFESSIONAL EXPLANATIONS)
  // -------------------------------------------------------------
  readingState: {
    part: 5,
    sessionData: null,
    answers: {},
    timerInterval: null,
    elapsedSeconds: 0
  },

  async startReadingSession({ part = 5 }) {
    try {
      this.readingState.part = part;
      this.readingState.answers = {};
      this.readingState.elapsedSeconds = 0;
      clearInterval(this.readingState.timerInterval);

      document.getElementById('reading-explanation-panel').style.display = 'none';
      document.getElementById('btn-reading-submit').style.display = 'inline-block';

      // Start timer
      const timerEl = document.getElementById('reading-timer');
      this.readingState.timerInterval = setInterval(() => {
        this.readingState.elapsedSeconds++;
        const mins = String(Math.floor(this.readingState.elapsedSeconds / 60)).padStart(2, '0');
        const secs = String(this.readingState.elapsedSeconds % 60).padStart(2, '0');
        if (timerEl) timerEl.innerText = `⏱️ ${mins}:${secs}`;
      }, 1000);

      this.readingState.sessionData = await API.getReadingSession(part);
      this.renderReadingTest();
    } catch (e) {
      showToast('Lỗi khởi tạo bài luyện Reading: ' + e.message);
    }
  },

  renderReadingTest() {
    const container = document.getElementById('reading-test-container');
    container.innerHTML = '';

    const data = this.readingState.sessionData;
    if (!data) return;

    if (data.type === 'single') {
      // Part 5
      const questions = data.questions || [];
      document.getElementById('reading-progress-counter').innerText = `${questions.length} câu Part 5`;

      questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'reading-q-card';
        card.innerHTML = `
          <div class="reading-q-number">Câu ${idx + 1} (${escapeHTML(q.question_type || 'Part 5')})</div>
          <div class="reading-q-text">${escapeHTML(q.question_text)}</div>
          <div class="reading-options-list">
            ${['A', 'B', 'C', 'D'].map(opt => `
              <label class="reading-option-item">
                <input type="radio" name="q_${q.id}" value="${opt}" onchange="App.onReadingOptionSelect('${q.id}', '${opt}')">
                <span><strong>(${opt})</strong> ${escapeHTML(q[`option_${opt.toLowerCase()}`])}</span>
              </label>
            `).join('')}
          </div>
        `;
        container.appendChild(card);
      });

    } else if (data.type === 'passage') {
      // Part 6 or Part 7
      const passages = data.passages || [];
      let totalQ = 0;
      passages.forEach(p => totalQ += (p.questions || []).length);
      document.getElementById('reading-progress-counter').innerText = `${totalQ} câu (${passages.length} đoạn văn)`;

      passages.forEach(p => {
        const splitView = document.createElement('div');
        splitView.className = 'reading-split-view';
        splitView.style.marginBottom = '2rem';

        // Left Passage Box
        const passageBox = document.createElement('div');
        passageBox.className = 'passage-card';
        passageBox.innerHTML = `
          <h3 class="passage-title">${escapeHTML(p.title || 'Đoạn văn')}</h3>
          <div>${escapeHTML(p.passage_text)}</div>
        `;

        // Right Questions Box
        const questionsBox = document.createElement('div');
        (p.questions || []).forEach((q) => {
          const qCard = document.createElement('div');
          qCard.className = 'reading-q-card';
          qCard.innerHTML = `
            <div class="reading-q-number">Câu ${q.question_number} (${escapeHTML(q.question_type || 'Part ' + p.part)})</div>
            <div class="reading-q-text">${escapeHTML(q.question_text)}</div>
            <div class="reading-options-list">
              ${['A', 'B', 'C', 'D'].map(opt => `
                <label class="reading-option-item">
                  <input type="radio" name="q_${q.id}" value="${opt}" onchange="App.onReadingOptionSelect('${q.id}', '${opt}')">
                  <span><strong>(${opt})</strong> ${escapeHTML(q[`option_${opt.toLowerCase()}`])}</span>
                </label>
              `).join('')}
            </div>
          `;
          questionsBox.appendChild(qCard);
        });

        splitView.appendChild(passageBox);
        splitView.appendChild(questionsBox);
        container.appendChild(splitView);
      });
    }
  },

  onReadingOptionSelect(qId, opt) {
    this.readingState.answers[qId] = opt;
  },

  async submitReadingTest() {
    clearInterval(this.readingState.timerInterval);

    const answersArray = Object.keys(this.readingState.answers).map(qId => ({
      questionId: qId,
      selectedOption: this.readingState.answers[qId]
    }));

    if (answersArray.length === 0) {
      if (!confirm('Bạn chưa chọn đáp án nào. Bạn có chắc chắn muốn nộp bài để xem đáp án & lời giải không?')) {
        return;
      }
    }

    try {
      const allRadioInputs = document.querySelectorAll('input[type="radio"][name^="q_"]');
      const renderedQIds = new Set();
      allRadioInputs.forEach(inp => renderedQIds.add(inp.name.replace('q_', '')));

      renderedQIds.forEach(qId => {
        if (!this.readingState.answers[qId]) {
          answersArray.push({ questionId: qId, selectedOption: '' });
        }
      });

      const res = await API.submitReadingAnswers(answersArray);
      document.getElementById('btn-reading-submit').style.display = 'none';
      this.renderReadingExplanation(res);

      showToast(`Đã nộp bài! Đạt ${res.correctCount}/${res.total} câu (${res.scorePct}%) 🎉`);
    } catch (e) {
      showToast('Lỗi nộp bài: ' + e.message);
    }
  },

  renderReadingExplanation(data) {
    const expPanel = document.getElementById('reading-explanation-panel');
    expPanel.style.display = 'block';
    expPanel.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h3 style="font-family: var(--font-serif); color: var(--accent-gold); font-size: 1.4rem;">Lời Giải Chi Tiết & Phân Tích Chuyên Nghiệp</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Xem lại từng câu, học từ vựng trực tiếp và lưu vào kho SRS 1-click</p>
        </div>
        <div style="background: rgba(0,0,0,0.3); padding: 0.6rem 1.2rem; border-radius: 12px; border: 1px solid var(--accent-teal); text-align: center;">
          <div style="font-family: var(--font-mono); font-size: 1.4rem; font-weight: bold; color: var(--accent-teal);">${data.scorePct}%</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${data.correctCount} / ${data.total} câu đúng</div>
        </div>
      </div>
    `;

    (data.results || []).forEach((res, idx) => {
      const qBlock = document.createElement('div');
      qBlock.className = 'exp-q-block';

      const isCorrect = res.isCorrect;
      const userOpt = res.userOption || 'Chưa chọn';

      let vocabRowsHtml = '';
      if (res.vocabHighlights && res.vocabHighlights.length > 0) {
        vocabRowsHtml = `
          <div style="margin-top: 1rem;">
            <div style="font-weight: bold; color: var(--accent-gold); font-size: 0.85rem; margin-bottom: 0.4rem;">📝 Từ vựng & Collocation rút ra từ câu này:</div>
            <table class="exp-vocab-table">
              <thead>
                <tr>
                  <th>Từ vựng (Term)</th>
                  <th>Từ loại & IPA</th>
                  <th>Nghĩa tiếng Việt</th>
                  <th>Thao tác SRS</th>
                </tr>
              </thead>
              <tbody>
                ${res.vocabHighlights.map(v => `
                  <tr>
                    <td><strong style="color: var(--accent-teal);">${escapeHTML(v.term)}</strong></td>
                    <td>[${escapeHTML(v.pos || 'general')}] ${escapeHTML(v.ipa || '')}</td>
                    <td>${escapeHTML(v.meaning)}</td>
                    <td>
                      <button class="btn-add-srs" onclick="App.addReadingVocabToSRS('${escapeHTML(v.term)}', '${escapeHTML(v.meaning)}', '${escapeHTML(v.pos || '')}', '${escapeHTML(v.ipa || '')}')">➕ Thêm SRS</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      qBlock.innerHTML = `
        <div class="exp-q-header">
          <span style="font-family: var(--font-mono); font-weight: bold;">Câu ${idx + 1}: ${escapeHTML(res.questionText)}</span>
          <div>
            <span style="font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 4px; margin-right: 6px;">${escapeHTML(res.questionType)}</span>
            <span class="${isCorrect ? 'exp-badge-correct' : 'exp-badge-incorrect'}">
              ${isCorrect ? '✅ ĐÚNG' : '❌ SAI'} (Bạn chọn: ${userOpt} | Đáp án: ${res.correctOption})
            </span>
          </div>
        </div>

        <div style="font-size: 0.9rem; margin-bottom: 0.6rem;">
          ${['A', 'B', 'C', 'D'].map(opt => {
            const isTarget = opt === res.correctOption;
            const isUserChoice = opt === res.userOption;
            let style = 'padding: 4px 8px; border-radius: 4px; margin-bottom: 3px; display: block;';
            if (isTarget) style += ' background: rgba(72, 187, 120, 0.2); color: #48bb78; font-weight: bold;';
            else if (isUserChoice && !isCorrect) style += ' background: rgba(245, 101, 101, 0.2); color: #f56565; text-decoration: line-through;';
            return `<div style="${style}">(${opt}) ${escapeHTML(res.options[opt])}</div>`;
          }).join('')}
        </div>

        ${res.translation ? `
          <div class="exp-box-translation">
            <strong>📖 Dịch nghĩa toàn câu/đoạn:</strong><br>${escapeHTML(res.translation)}
          </div>
        ` : ''}

        ${res.analysis ? `
          <div class="exp-box-analysis">
            <strong>💡 Phân tích & Lý do loại trừ:</strong><br>${escapeHTML(res.analysis)}
          </div>
        ` : ''}

        ${vocabRowsHtml}
      `;

      expPanel.appendChild(qBlock);
    });

    expPanel.scrollIntoView({ behavior: 'smooth' });
  },

  async addReadingVocabToSRS(term, meaning, pos, ipa) {
    try {
      const res = await API.addReadingVocabToSRS({ term, meaning, pos, ipa });
      showToast(res.message);
    } catch (e) {
      showToast('Lỗi lưu từ SRS: ' + e.message);
    }
  },

  // -------------------------------------------------------------
  // WORD DROP GAME INTEGRATION
  // -------------------------------------------------------------
  wordDropGameInstance: null,

  async initWordDropView() {
    // Populate topic dropdown if empty
    const select = document.getElementById('word-drop-topic-select');
    if (select && select.options.length <= 1) {
      try {
        const topics = await API.getTopics();
        select.innerHTML = '<option value="">Tất cả chủ đề (Mặc định)</option>';
        topics.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.innerText = `${t.name} (${t.word_count} từ)`;
          select.appendChild(opt);
        });
      } catch (e) {
        console.error('Lỗi nạp topics cho Word Drop:', e);
      }
    }

    const canvas = document.getElementById('word-drop-canvas');
    const input = document.getElementById('word-drop-input');

    if (!this.wordDropGameInstance) {
      this.wordDropGameInstance = new WordDropGame(canvas, input, {
        onGameEnd: () => {
          // Refresh dashboard data silently in background
        }
      });

      document.getElementById('btn-word-drop-start').onclick = () => this.wordDropGameInstance.start();
      document.getElementById('btn-word-drop-modal-start').onclick = () => this.wordDropGameInstance.start();
      document.getElementById('btn-word-drop-pause').onclick = () => {
        if (this.wordDropGameInstance.isPaused) {
          this.wordDropGameInstance.resume();
          document.getElementById('btn-word-drop-pause').innerText = 'Tạm dừng';
        } else {
          this.wordDropGameInstance.pause();
          document.getElementById('btn-word-drop-pause').innerText = 'Tiếp tục ▶️';
        }
      };
      document.getElementById('btn-word-drop-restart').onclick = () => this.wordDropGameInstance.restart();
      document.getElementById('btn-word-drop-play-again').onclick = () => this.wordDropGameInstance.restart();
    } else {
      this.wordDropGameInstance.resizeCanvas();
    }
  }
};

// =============================================================
// WORD DROP GAME CLASS
// =============================================================
class WordDropGame {
  constructor(canvas, input, config = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;

    // Default configuration (Tốc độ ban đầu giảm 1 nửa: 0.6 thay vì 1.2, khoảng cách rơi thong thả 3500ms)
    this.defaultConfig = {
      fallSpeed: 0.6,        // px/frame ban đầu (chậm lại gấp đôi)
      spawnInterval: 3500,   // ms giữa 2 từ rơi (thoải mái thời gian gõ)
      speedIncreasePerLevel: 0.15, // tăng nhẹ mỗi level
      lives: 3,
      levelUpEvery: 10,      // số từ đúng để lên level
    };

    this.config = { ...this.defaultConfig, ...config };

    // State
    this.wordsQueue = [];      // pool of words fetched from API
    this.activeWords = [];     // currently falling words on canvas
    this.particles = [];       // particle explosion effects
    this.score = 0;
    this.level = 1;
    this.lives = this.config.lives;
    this.combo = 0;
    this.correctCount = 0;
    this.missedCount = 0;
    this.sessionHistory = [];  // [{word_id, typed_correctly, response_time_ms}]
    this.activeWordSpawnTimes = new Map(); // word.id -> spawn timestamp

    this.isRunning = false;
    this.isPaused = false;
    this.animationFrameId = null;
    this.spawnTimerId = null;
    this.lastFrameTime = performance.now();

    this.setupListeners();
    this.resizeCanvas();
  }

  setupListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.input.addEventListener('input', () => this.checkInput());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        const rawTyped = this.input.value.trim().toLowerCase();

        // Nếu có nội dung gõ, kiểm tra xem có khớp với từ nào đang rơi không
        if (rawTyped.length > 0) {
          let matchedWord = null;

          // 1. Ưu tiên khớp chính xác tuyệt đối
          matchedWord = this.activeWords.find(w => w.term.trim().toLowerCase() === rawTyped);

          // 2. Nếu chưa khớp chính xác, kiểm tra xem có từ nào bắt đầu bằng từ vừa gõ không
          if (!matchedWord) {
            // Sắp xếp các từ bắt đầu bằng rawTyped theo vị trí rơi sâu nhất (y lớn nhất) để ưu tiên từ sắp chạm đáy
            const candidateWords = this.activeWords
              .filter(w => w.term.trim().toLowerCase().startsWith(rawTyped))
              .sort((a, b) => b.y - a.y);

            if (candidateWords.length > 0) {
              matchedWord = candidateWords[0];
            }
          }

          if (matchedWord) {
            e.preventDefault();
            const index = this.activeWords.indexOf(matchedWord);
            if (index !== -1) {
              this.activeWords.splice(index, 1);
              this.onWordTyped(matchedWord);
            }
            this.input.value = '';
            return;
          }
        }

        // Nếu ô nhập trống hoặc nhấn cách để xóa nhanh ô nhập
        if (e.key === ' ') {
          // Nếu ô nhập đang trống, chặn khoảng trắng thừa
          if (this.input.value.trim() === '') {
            e.preventDefault();
            this.input.value = '';
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.input.value = '';
        }
      }
    });
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth || 800;
    const height = parent.clientHeight || 500;

    // Use device pixel ratio for crystal clear text rendering on high DPI
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
    this.cssWidth = width;
    this.cssHeight = height;
  }

  async start() {
    this.cleanup();
    this.resizeCanvas();

    const topicSelect = document.getElementById('word-drop-topic-select');
    const modeSelect = document.getElementById('word-drop-mode-select');
    const topicId = topicSelect ? topicSelect.value : '';
    const mode = modeSelect ? modeSelect.value : 'srs';

    // UI overlays
    document.getElementById('word-drop-start-overlay').style.display = 'none';
    document.getElementById('word-drop-gameover-overlay').style.display = 'none';
    document.getElementById('btn-word-drop-pause').innerText = 'Tạm dừng';

    try {
      const words = await API.getWordDropWords({ topicId, limit: 30, mode });
      if (!words || words.length === 0) {
        showToast('Không có từ vựng nào trong chủ đề này!');
        return;
      }

      this.wordsQueue = [...words];
      shuffle(this.wordsQueue);

      this.score = 0;
      this.level = 1;
      this.lives = this.config.lives;
      this.combo = 0;
      this.correctCount = 0;
      this.missedCount = 0;
      this.sessionHistory = [];
      this.activeWords = [];
      this.particles = [];
      this.activeWordSpawnTimes.clear();

      this.currentFallSpeed = this.config.fallSpeed;
      this.currentSpawnInterval = this.config.spawnInterval;

      this.isRunning = true;
      this.isPaused = false;
      this.updateHUD();

      this.input.value = '';
      this.input.focus();

      // Spawn first word immediately
      this.spawnWord();
      this.scheduleNextSpawn();

      this.lastFrameTime = performance.now();
      this.animationFrameId = requestAnimationFrame((t) => this.updateFrame(t));
    } catch (e) {
      showToast('Lỗi nạp từ vựng: ' + e.message);
    }
  }

  pause() {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    cancelAnimationFrame(this.animationFrameId);
    clearTimeout(this.spawnTimerId);
  }

  resume() {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.scheduleNextSpawn();
    this.animationFrameId = requestAnimationFrame((t) => this.updateFrame(t));
    this.input.focus();
  }

  restart() {
    this.cleanup();
    this.start();
  }

  cleanup() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.spawnTimerId) clearTimeout(this.spawnTimerId);
  }

  scheduleNextSpawn() {
    if (!this.isRunning || this.isPaused) return;
    this.spawnTimerId = setTimeout(() => {
      this.spawnWord();
      this.scheduleNextSpawn();
    }, this.currentSpawnInterval);
  }

  spawnWord() {
    if (!this.isRunning || this.isPaused) return;

    // If queue is empty, replenish from history or restart queue
    if (this.wordsQueue.length === 0) {
      if (this.activeWords.length === 0) {
        this.onGameOver(true);
        return;
      }
      return;
    }

    const wordData = this.wordsQueue.shift();
    const padding = 80;
    const spawnWidth = Math.max(200, (this.cssWidth || 800) - padding * 2);
    const x = padding + Math.random() * spawnWidth;

    const newFallingWord = {
      ...wordData,
      x: x,
      y: -30,
      speed: this.currentFallSpeed + (Math.random() * 0.2 - 0.1),
      matchedChars: 0,
      glow: 0
    };

    this.activeWords.push(newFallingWord);
    this.activeWordSpawnTimes.set(wordData.id, performance.now());
  }

  updateFrame(currentTime) {
    if (!this.isRunning || this.isPaused) return;

    const deltaTime = Math.min(50, currentTime - this.lastFrameTime) / 16.666; // Normalized to 60fps
    this.lastFrameTime = currentTime;

    const bottomLimit = (this.cssHeight || 500) - 20;

    // Move words down & check bottom collision
    for (let i = this.activeWords.length - 1; i >= 0; i--) {
      const w = this.activeWords[i];
      w.y += w.speed * deltaTime;

      if (w.y >= bottomLimit) {
        this.activeWords.splice(i, 1);
        this.onWordMissed(w);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.radius += p.dr * deltaTime;
      p.alpha -= p.decay * deltaTime;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Render step
    this.render();

    if (this.isRunning) {
      this.animationFrameId = requestAnimationFrame((t) => this.updateFrame(t));
    }
  }

  checkInput() {
    if (!this.isRunning || this.isPaused) return;

    const rawTyped = this.input.value.trim().toLowerCase();
    if (!rawTyped) {
      // Clear glows
      this.activeWords.forEach(w => { w.glow = 0; w.matchedChars = 0; });
      return;
    }

    let exactMatchFound = null;

    // Check words
    this.activeWords.forEach(w => {
      const cleanTerm = w.term.trim().toLowerCase();

      if (cleanTerm === rawTyped) {
        exactMatchFound = w;
      } else if (cleanTerm.startsWith(rawTyped)) {
        w.glow = 1.0;
        w.matchedChars = rawTyped.length;
      } else {
        w.glow = 0;
        w.matchedChars = 0;
      }
    });

    if (exactMatchFound) {
      const index = this.activeWords.indexOf(exactMatchFound);
      if (index !== -1) {
        this.activeWords.splice(index, 1);
        this.onWordTyped(exactMatchFound);
        this.input.value = '';
      }
    }
  }

  onWordTyped(word) {
    const spawnTime = this.activeWordSpawnTimes.get(word.id) || performance.now();
    const responseTime = Math.round(performance.now() - spawnTime);

    this.correctCount++;
    this.combo++;

    // Calculate score: base (10 * level) + combo bonus + speed bonus
    const speedBonus = Math.max(0, Math.round((5000 - responseTime) / 500));
    const comboBonus = Math.min(20, this.combo * 2);
    const addedScore = (10 * this.level) + comboBonus + speedBonus;
    this.score += addedScore;

    // Record history
    this.sessionHistory.push({
      word_id: word.id,
      typed_correctly: true,
      response_time_ms: responseTime
    });

    // Create explosion particle effect
    this.createExplosion(word.x, word.y, '#4FBDBA');

    // Check level up
    if (this.correctCount % this.config.levelUpEvery === 0) {
      this.levelUp();
    }

    this.updateHUD();
  }

  onWordMissed(word) {
    const spawnTime = this.activeWordSpawnTimes.get(word.id) || performance.now();
    const responseTime = Math.round(performance.now() - spawnTime);

    this.missedCount++;
    this.combo = 0;
    this.lives--;

    // Record history
    this.sessionHistory.push({
      word_id: word.id,
      typed_correctly: false,
      response_time_ms: responseTime
    });

    // Shake canvas and particle
    this.shakeCanvas();
    this.createExplosion(word.x, word.y, '#E8623D');

    this.updateHUD();

    if (this.lives <= 0) {
      this.onGameOver(false);
    }
  }

  levelUp() {
    this.level++;
    this.currentFallSpeed += this.config.speedIncreasePerLevel;
    this.currentSpawnInterval = Math.max(1200, this.currentSpawnInterval - 150);

    showToast(`🎉 LÊN LEVEL ${this.level}! Tốc độ rơi tăng lên!`);
  }

  shakeCanvas() {
    const wrapper = document.getElementById('word-drop-canvas-wrapper');
    if (wrapper) {
      wrapper.classList.remove('shake');
      void wrapper.offsetWidth; // Force reflow
      wrapper.classList.add('shake');
    }
  }

  createExplosion(x, y, color = '#4FBDBA') {
    // Ring particle
    this.particles.push({
      x, y, vx: 0, vy: 0, radius: 10, dr: 3, alpha: 1.0, decay: 0.04, color, isRing: true
    });

    // Spark particles
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      const speed = 2 + Math.random() * 3;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 2,
        dr: -0.05,
        alpha: 1.0,
        decay: 0.03,
        color,
        isRing: false
      });
    }
  }

  updateHUD() {
    const scoreEl = document.getElementById('wd-score');
    const levelEl = document.getElementById('wd-level');
    const livesEl = document.getElementById('wd-lives');
    const comboEl = document.getElementById('wd-combo');
    const accEl = document.getElementById('wd-accuracy');

    if (scoreEl) scoreEl.innerText = this.score;
    if (levelEl) levelEl.innerText = this.level;
    if (livesEl) {
      const heartString = '❤️'.repeat(Math.max(0, this.lives)) + '🖤'.repeat(Math.max(0, this.config.lives - this.lives));
      livesEl.innerText = heartString;
    }
    if (comboEl) comboEl.innerText = this.combo > 1 ? `x${this.combo}` : `${this.combo}`;

    const total = this.correctCount + this.missedCount;
    const acc = total > 0 ? Math.round((this.correctCount / total) * 100) : 100;
    if (accEl) accEl.innerText = `${acc}%`;
  }

  render() {
    const w = this.cssWidth || 800;
    const h = this.cssHeight || 500;

    // Clear background
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, w, h);

    // Draw subtle grid lines
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    this.ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 60) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
      this.ctx.stroke();
    }

    // Danger zone red gradient at bottom
    const grad = this.ctx.createLinearGradient(0, h - 35, 0, h);
    grad.addColorStop(0, 'rgba(232, 98, 61, 0)');
    grad.addColorStop(1, 'rgba(232, 98, 61, 0.25)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, h - 35, w, 35);

    // Danger line
    this.ctx.strokeStyle = 'rgba(232, 98, 61, 0.6)';
    this.ctx.setLineDash([6, 6]);
    this.ctx.beginPath();
    this.ctx.moveTo(0, h - 25);
    this.ctx.lineTo(w, h - 25);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw Falling Words
    this.renderWords();

    // Draw Particles
    this.renderParticles();

    // Draw HUD Canvas Notifications (Combo indicator)
    this.renderHUD();
  }

  renderWords() {
    this.ctx.textAlign = 'center';

    this.activeWords.forEach(w => {
      // Glow pill background
      const termFont = '700 20px "Fraunces", serif';
      this.ctx.font = termFont;
      const termMetrics = this.ctx.measureText(w.term);
      const boxWidth = Math.max(140, termMetrics.width + 36);
      const boxHeight = 52;
      const boxX = w.x - boxWidth / 2;
      const boxY = w.y - 26;

      // Card background
      this.ctx.save();
      this.ctx.shadowColor = w.glow > 0 ? '#4FBDBA' : 'rgba(0, 0, 0, 0.5)';
      this.ctx.shadowBlur = w.glow > 0 ? 18 : 8;

      this.ctx.fillStyle = w.glow > 0 ? 'rgba(30, 48, 55, 0.95)' : 'rgba(30, 36, 48, 0.9)';
      this.ctx.strokeStyle = w.glow > 0 ? '#4FBDBA' : 'rgba(255, 255, 255, 0.12)';
      this.ctx.lineWidth = w.glow > 0 ? 2 : 1;

      // Draw rounded rectangle
      this.roundRect(this.ctx, boxX, boxY, boxWidth, boxHeight, 8);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();

      // Render Word Term (Highlight matched characters)
      if (w.matchedChars > 0) {
        const matched = w.term.slice(0, w.matchedChars);
        const remainder = w.term.slice(w.matchedChars);

        const fullWidth = termMetrics.width;
        this.ctx.font = termFont;
        const matchedWidth = this.ctx.measureText(matched).width;
        const remainderWidth = this.ctx.measureText(remainder).width;

        const startX = w.x - fullWidth / 2;

        this.ctx.textAlign = 'left';
        // Green highlight for matched prefix
        this.ctx.fillStyle = '#4FBDBA';
        this.ctx.fillText(matched, startX, w.y - 4);

        // Gold for remaining
        this.ctx.fillStyle = '#E8B84B';
        this.ctx.fillText(remainder, startX + matchedWidth, w.y - 4);
        this.ctx.textAlign = 'center';
      } else {
        this.ctx.fillStyle = '#E8B84B';
        this.ctx.font = termFont;
        this.ctx.fillText(w.term, w.x, w.y - 4);
      }

      // Render Meaning smaller underneath
      this.ctx.fillStyle = 'rgba(226, 232, 240, 0.75)';
      this.ctx.font = '500 11.5px "IBM Plex Sans", sans-serif';
      const meaningText = w.meaning.length > 25 ? w.meaning.slice(0, 23) + '...' : w.meaning;
      this.ctx.fillText(meaningText, w.x, w.y + 14);
    });
  }

  renderParticles() {
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.strokeStyle = p.color;
      this.ctx.fillStyle = p.color;

      if (p.isRing) {
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, Math.max(0, p.radius), 0, Math.PI * 2);
        this.ctx.stroke();
      } else {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, Math.max(0, p.radius), 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    });
  }

  renderHUD() {
    // Show Combo alert when combo >= 3
    if (this.combo >= 3) {
      this.ctx.save();
      this.ctx.textAlign = 'right';
      this.ctx.font = '700 16px "IBM Plex Mono", monospace';
      this.ctx.fillStyle = '#E8623D';
      this.ctx.shadowColor = '#E8623D';
      this.ctx.shadowBlur = 10;
      this.ctx.fillText(`🔥 x${this.combo} COMBO!`, (this.cssWidth || 800) - 20, 35);
      this.ctx.restore();
    }
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  async onGameOver(completedAll = false) {
    this.cleanup();

    const total = this.correctCount + this.missedCount;
    const accuracy = total > 0 ? Math.round((this.correctCount / total) * 100) : 0;

    // Show game over overlay
    const overlay = document.getElementById('word-drop-gameover-overlay');
    const title = document.getElementById('wd-gameover-title');
    const icon = document.getElementById('wd-gameover-icon');

    if (title) title.innerText = completedAll ? 'Xuất Sắc! Đã Hoàn Thành Toàn Bộ Từ!' : 'Trò Chơi Kết Thúc!';
    if (icon) icon.innerText = completedAll ? '🏆' : '💀';

    document.getElementById('wd-final-score').innerText = this.score;
    document.getElementById('wd-final-level').innerText = this.level;
    document.getElementById('wd-final-correct').innerText = this.correctCount;
    document.getElementById('wd-final-missed').innerText = this.missedCount;
    document.getElementById('wd-final-accuracy').innerText = `${accuracy}%`;

    overlay.style.display = 'flex';

    // POST results to server to update SRS and daily_log
    if (this.sessionHistory.length > 0) {
      try {
        const res = await API.postWordDropResult({
          session_words: this.sessionHistory,
          score: this.score,
          accuracy: accuracy
        });
        showToast(`Đã đồng bộ ${res.updatedWords} từ vào SRS! Streak: ${res.streak} ngày 🔥`);
      } catch (e) {
        showToast('Lỗi lưu kết quả SRS: ' + e.message);
      }
    }
  }
}

// -------------------------------------------------------------
// GENERAL UTILITIES
// -------------------------------------------------------------
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(text) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-text').innerText = text;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Launch App
App.init();
