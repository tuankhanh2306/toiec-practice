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

  async getReviewSession({ category, value }) {
    let url = '/api/review-session?';
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

  async postReview(wordId, correct) {
    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId, correct })
    });
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

  // Distractor pool for Quiz
  quizDistractorPool: [],

  init() {
    // Hash Router
    window.addEventListener('hashchange', () => this.route());
    this.route();

    this.bindEvents();
    this.renderDashboard();
    this.loadSettings();
  },

  route() {
    const hash = location.hash.substring(1) || 'dashboard';
    const parts = hash.split('/');
    const viewName = parts[0];
    const category = parts[1]; // 'topic', 'specialty', 'context'
    const value = parts[2] ? decodeURIComponent(parts[2]) : null;

    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    const targetView = document.getElementById(viewName);
    if (targetView) {
      targetView.classList.add('active');
      this.currentView = viewName;

      // Highlight Nav link
      const navBtn = document.getElementById(`nav-${viewName}`);
      if (navBtn) navBtn.classList.add('active');

      // Execute View specific transitions/loaders
      if (viewName === 'dashboard') {
        this.renderDashboard();
      } else if (viewName === 'flashcard') {
        this.startFlashcardSession({ category, value });
      } else if (viewName === 'quiz') {
        this.startQuizSession({ category, value });
      } else if (viewName === 'game') {
        this.startGameSession({ category, value });
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

    // Dropzone drag-drop implementation
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');

      if (e.dataTransfer.files.length > 0) {
        this.handleFileImport(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileImport(e.target.files[0]);
      }
    });

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

    // Dashboard Tabs Filter Switching
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Hide all tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

        // Show selected pane
        const targetTabName = tab.getAttribute('data-tab');
        document.getElementById(`tab-content-${targetTabName}`).classList.add('active');
      });
    });

    // Keyboard Support for Flashcard Screen
    document.addEventListener('keydown', (e) => {
      if (this.currentView === 'flashcard' && this.sessionWords.length > 0) {
        if (e.code === 'Space') {
          e.preventDefault();
          this.toggleFlashcardReveal();
        } else if (e.key === '1') {
          const wrongBtn = document.getElementById('btn-grade-wrong');
          if (wrongBtn && wrongBtn.offsetParent !== null) {
            this.gradeFlashcard(false);
          }
        } else if (e.key === '2') {
          const correctBtn = document.getElementById('btn-grade-correct');
          if (correctBtn && correctBtn.offsetParent !== null) {
            this.gradeFlashcard(true);
          }
        }
      }
    });

    // Reveal card click listener
    document.getElementById('card-perspective').addEventListener('click', () => {
      this.toggleFlashcardReveal();
    });
    document.getElementById('btn-reveal-card').addEventListener('click', () => {
      this.toggleFlashcardReveal();
    });

    // Grading click listeners
    document.getElementById('btn-grade-wrong').addEventListener('click', () => this.gradeFlashcard(false));
    document.getElementById('btn-grade-correct').addEventListener('click', () => this.gradeFlashcard(true));

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

    // Hide dropzone border during upload loading
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
      document.getElementById('file-input').value = ''; // Reset input
    }
  },

  // -------------------------------------------------------------
  // DASHBOARD RENDERER
  // -------------------------------------------------------------
  async renderDashboard() {
    try {
      const data = await API.getDashboard();

      // Render statistics counts
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
      const specialties = data.specialties || [];

      if (specialties.length === 0) {
        specialtiesContainer.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background-color: var(--surface-card); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.05);">
            <p style="color: var(--text-muted); margin-bottom: 1rem;">Chưa có dữ liệu chuyên ngành. AI sẽ tự động tạo khi bạn upload tài liệu.</p>
          </div>
        `;
      } else {
        specialties.forEach(spec => {
          const card = document.createElement('div');
          card.className = 'topic-card';
          card.innerHTML = `
            <div>
              <h3 class="topic-title" style="color: var(--accent-teal);">Chuyên ngành: ${escapeHTML(spec.name)}</h3>
              <div class="topic-meta">
                <span class="meta-tag">${spec.count} thuật ngữ</span>
              </div>
            </div>
            <div class="topic-actions">
              <a href="#flashcard/specialty/${encodeURIComponent(spec.name)}" class="btn btn-primary">Flashcard</a>
              <a href="#quiz/specialty/${encodeURIComponent(spec.name)}" class="btn btn-secondary">Quiz</a>
              <a href="#game/specialty/${encodeURIComponent(spec.name)}" class="btn btn-secondary">Game</a>
            </div>
          `;
          specialtiesContainer.appendChild(card);
        });
      }

      // Render Contexts List
      const contextsContainer = document.getElementById('contexts-list');
      contextsContainer.innerHTML = '';
      const contexts = data.contexts || [];

      if (contexts.length === 0) {
        contextsContainer.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background-color: var(--surface-card); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.05);">
            <p style="color: var(--text-muted); margin-bottom: 1rem;">Chưa có dữ liệu hoàn cảnh sử dụng. AI sẽ tự động phân loại khi bạn upload tài liệu.</p>
          </div>
        `;
      } else {
        contexts.forEach(ctx => {
          const card = document.createElement('div');
          card.className = 'topic-card';
          card.innerHTML = `
            <div>
              <h3 class="topic-title" style="color: var(--accent-gold);">Ngữ cảnh: ${escapeHTML(ctx.name)}</h3>
              <div class="topic-meta">
                <span class="meta-tag">${ctx.count} từ vựng</span>
              </div>
            </div>
            <div class="topic-actions">
              <a href="#flashcard/context/${encodeURIComponent(ctx.name)}" class="btn btn-primary">Flashcard</a>
              <a href="#quiz/context/${encodeURIComponent(ctx.name)}" class="btn btn-secondary">Quiz</a>
              <a href="#game/context/${encodeURIComponent(ctx.name)}" class="btn btn-secondary">Game</a>
            </div>
          `;
          contextsContainer.appendChild(card);
        });
      }

    } catch (error) {
      console.error(error);
      showToast('Lỗi tải dữ liệu Dashboard từ Server.');
    }
  },

  // -------------------------------------------------------------
  // FLASHCARD FLOW
  // -------------------------------------------------------------
  async startFlashcardSession({ category, value }) {
    try {
      this.sessionWords = await API.getReviewSession({ category, value });
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

    // Progress bar and numbers
    const total = this.sessionWords.length;
    const current = this.currentWordIndex + 1;
    document.getElementById('flashcard-counter').innerText = `${current}/${total}`;
    document.getElementById('flashcard-progress-bar').style.width = `${(current / total) * 100}%`;

    // Render card texts
    document.getElementById('card-front-term').innerText = word.term;
    document.getElementById('card-back-meaning').innerText = word.meaning;
    document.getElementById('card-back-specialty').innerText = word.specialty || 'Chung';
    document.getElementById('card-back-context').innerText = word.context || 'Chung';
    document.getElementById('card-back-example').innerText = word.example || 'Không có ví dụ';

    // Add badge type: Mới / Đến hạn / Gối đầu
    const badgeContainer = document.getElementById('card-front-badge-container');
    badgeContainer.innerHTML = '';
    if (word.sessionType) {
      const badge = document.createElement('span');
      badge.className = `word-badge ${word.sessionType === 'NEW' ? 'badge-new' : word.sessionType === 'DUE' ? 'badge-due' : 'badge-review'}`;
      badge.innerText = word.sessionType === 'NEW' ? 'Mới' : word.sessionType === 'DUE' ? 'Đến hạn' : 'Gối đầu';
      badgeContainer.appendChild(badge);
    }

    // Set SRS colors for dog ear based on level
    const srsColor = getComputedStyle(document.documentElement).getPropertyValue(`--srs-${word.srsLevel || 0}`).trim();
    document.getElementById('card-front-dogear').style.setProperty('--srs-level-color', srsColor);
    document.getElementById('card-back-dogear').style.setProperty('--srs-level-color', srsColor);
  },

  toggleFlashcardReveal() {
    const perspective = document.getElementById('card-perspective');
    if (!perspective.classList.contains('flipped')) {
      perspective.classList.add('flipped');
      document.getElementById('flashcard-actions-hint').style.display = 'none';
      document.getElementById('flashcard-actions-grade').style.display = 'flex';
    }
  },

  async gradeFlashcard(correct) {
    const word = this.sessionWords[this.currentWordIndex];

    try {
      // Post review progress to API
      const result = await API.postReview(word.id, correct);

      if (correct) {
        this.sessionResults.correct++;
      } else {
        this.sessionResults.incorrect++;
      }
      this.sessionResults.reviewedIds.push(word.id);

      // Advance
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
  // QUIZ FLOW
  // -------------------------------------------------------------
  async startQuizSession({ category, value }) {
    try {
      this.sessionWords = await API.getReviewSession({ category, value });
      this.currentWordIndex = 0;
      this.sessionResults = { correct: 0, incorrect: 0, reviewedIds: [] };

      if (this.sessionWords.length === 0) {
        showToast('Nhóm từ này không còn từ nào cần ôn tập hôm nay!');
        location.hash = '#dashboard';
        return;
      }

      // Query database for a large set of words to make distractor choices
      const tempSession = await API.getReviewSession({ limit: 100 });
      this.quizDistractorPool = tempSession.length > 5 ? tempSession : this.sessionWords;

      this.renderQuizQuestion();
    } catch (e) {
      showToast('Lỗi khởi tạo phiên Quiz: ' + e.message);
      location.hash = '#dashboard';
    }
  },

  renderQuizQuestion() {
    document.getElementById('btn-quiz-next').style.display = 'none';

    const word = this.sessionWords[this.currentWordIndex];

    // Progress bar
    const total = this.sessionWords.length;
    const current = this.currentWordIndex + 1;
    document.getElementById('quiz-counter').innerText = `${current}/${total}`;
    document.getElementById('quiz-progress-bar').style.width = `${(current / total) * 100}%`;

    document.getElementById('quiz-question-word').innerText = word.term;

    // Render badge
    const badgeContainer = document.getElementById('quiz-badge-container');
    badgeContainer.innerHTML = '';
    if (word.sessionType) {
      const badge = document.createElement('span');
      badge.className = `word-badge ${word.sessionType === 'NEW' ? 'badge-new' : word.sessionType === 'DUE' ? 'badge-due' : 'badge-review'}`;
      badge.innerText = word.sessionType === 'NEW' ? 'Mới' : word.sessionType === 'DUE' ? 'Đến Hạn' : 'Gối Đầu';
      badgeContainer.appendChild(badge);
    }

    // Assemble options
    const correctMeaning = word.meaning;
    const options = [correctMeaning];

    // Distractors
    const filteredPool = this.quizDistractorPool.filter(w => w.meaning !== correctMeaning);
    shuffle(filteredPool);

    for (let i = 0; i < Math.min(3, filteredPool.length); i++) {
      options.push(filteredPool[i].meaning);
    }

    while (options.length < 4) {
      options.push(`Đáp án nhiễu #${options.length}`);
    }

    shuffle(options);

    // Render
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
      btn.addEventListener('click', () => this.handleQuizAnswer(btn, optText, correctMeaning));
      optionsContainer.appendChild(btn);
    });
  },

  async handleQuizAnswer(selectedOptionEl, chosenText, correctText) {
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(opt => opt.style.pointerEvents = 'none'); // Lock selections

    const isCorrect = (chosenText === correctText);
    const word = this.sessionWords[this.currentWordIndex];

    // Highlight
    options.forEach(opt => {
      const text = opt.querySelector('span span:nth-child(2)').innerText;
      if (text === correctText) {
        opt.classList.add('correct');
      } else if (opt === selectedOptionEl && !isCorrect) {
        opt.classList.add('incorrect');
      }
    });

    try {
      const result = await API.postReview(word.id, isCorrect);

      if (isCorrect) {
        this.sessionResults.correct++;
      } else {
        this.sessionResults.incorrect++;
      }
      this.sessionResults.reviewedIds.push(word.id);

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

  // -------------------------------------------------------------
  // MATCHING GAME FLOW
  // -------------------------------------------------------------
  async startGameSession({ category, value }) {
    try {
      // Fetch vocabulary matching search criteria
      let rawWords = [];
      if (category === 'topic') {
        rawWords = await API.getWordsByTopic(value);
      } else if (category === 'specialty') {
        rawWords = await API.getWordsBySpecialty(value);
      } else if (category === 'context') {
        rawWords = await API.getWordsByContext(value);
      } else {
        // Fallback: load general review session words
        rawWords = await API.getReviewSession({ limit: 12 });
      }

      if (rawWords.length < 3) {
        showToast('Cần ít nhất 3 từ vựng trong nhóm này để chơi game ghép cặp!');
        location.hash = '#dashboard';
        return;
      }

      // Limit to 8 words for a 4x4 grid (8 terms + 8 meanings)
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

      // Start timer countdown
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

      if (card.matched) {
        cardEl.classList.add('matched');
      }

      cardEl.addEventListener('click', () => this.handleCardSelect(card, cardEl));
      grid.appendChild(cardEl);
    });
  },

  async handleCardSelect(card, cardEl) {
    if (card.matched) return;

    // Clear previous errors
    document.querySelectorAll('.matching-card.wrong').forEach(el => el.classList.remove('wrong'));

    if (!this.selectedMatchingCard) {
      // First card selection
      this.selectedMatchingCard = { card, el: cardEl };
      cardEl.classList.add('selected');
    } else {
      const first = this.selectedMatchingCard;

      // Unselect card if clicked twice
      if (first.card.id === card.id) {
        first.el.classList.remove('selected');
        this.selectedMatchingCard = null;
        return;
      }

      // Check matching pair
      if (first.card.matchId === card.matchId && first.card.type !== card.type) {
        // MATCH SUCCESS!
        first.card.matched = true;
        card.matched = true;

        first.el.classList.remove('selected');
        first.el.classList.add('matched');
        cardEl.classList.add('matched');

        this.gameScore++;
        document.getElementById('game-score-val').innerText = this.gameScore;

        this.selectedMatchingCard = null;

        // Apply SRS progress correct review in background
        try {
          await API.postReview(card.matchId, true);
        } catch (e) {
          console.error("SRS fail:", e);
        }

        // Check completion
        if (this.matchingCards.every(c => c.matched)) {
          clearInterval(this.gameTimer);
          showToast('Xuất sắc! Đã ghép đúng toàn bộ.');
          setTimeout(() => this.showGameResults(), 800);
        }
      } else {
        // MATCH WRONG
        first.el.classList.remove('selected');
        first.el.classList.add('wrong');
        cardEl.classList.add('wrong');

        this.selectedMatchingCard = null;

        // Apply wrong review in background (lower level)
        try {
          await API.postReview(card.matchId, false);
          await API.postReview(first.card.matchId, false);
        } catch (e) {
          console.error("SRS fail:", e);
        }

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

  // -------------------------------------------------------------
  // SESSION END SUMMARY
  // -------------------------------------------------------------
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

    location.hash = '#results';
  }
};

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
