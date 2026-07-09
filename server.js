const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const multer = require('multer');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for memory upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

let db;

// -------------------------------------------------------------
// DATABASE INITIALIZATION
// -------------------------------------------------------------
async function initDb() {
  db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT,
      word_count INTEGER DEFAULT 0,
      added_at TEXT NOT NULL,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS words (
      id TEXT PRIMARY KEY,
      topic_id TEXT REFERENCES topics(id) ON DELETE CASCADE,
      term TEXT NOT NULL,
      meaning TEXT NOT NULL,
      context TEXT,
      specialty TEXT,
      example TEXT,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS learning_state (
      word_id TEXT PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
      level INTEGER DEFAULT 0,
      last_reviewed TEXT,
      next_review TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_log (
      date TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0
    );
  `);
}

// -------------------------------------------------------------
// HELPER FUNCTIONS
// -------------------------------------------------------------
function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  const row = await db.get("SELECT value FROM settings WHERE key = 'gemini_api_key'");
  return row ? row.value : null;
}

// Calculate streak based on daily log
async function updateAndGetStreak() {
  const rows = await db.all("SELECT date, count FROM daily_log WHERE count > 0 ORDER BY date DESC");
  const dailyLog = {};
  rows.forEach(r => {
    dailyLog[r.date] = r.count;
  });

  let streak = 0;
  let checkDate = new Date();
  let todayStr = getTodayString();

  // If no activity today, check yesterday. If yesterday also has no activity, streak is 0.
  if (!dailyLog[todayStr]) {
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (!dailyLog[yesterdayStr]) {
      return 0;
    }
  }

  // Loop backwards and count consecutive active days
  while (true) {
    const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (dailyLog[dateStr] && dailyLog[dateStr] > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// Shuffler
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Parsing text representation (term - meaning - example)
function parseTextData(text) {
  const lines = text.split('\n');
  const words = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    let parts = [];
    if (line.includes(' - ')) {
      parts = line.split(' - ');
    } else if (line.includes(' | ')) {
      parts = line.split(' | ');
    } else if (line.includes('\t')) {
      parts = line.split('\t');
    } else {
      const commaIdx = line.indexOf(',');
      if (commaIdx !== -1) {
        parts = [line.slice(0, commaIdx), line.slice(commaIdx + 1)];
      } else {
        parts = [line];
      }
    }

    if (parts.length > 0) {
      const term = parts[0].trim();
      const meaning = parts[1] ? parts[1].trim() : 'Chưa có định nghĩa';
      const example = parts[2] ? parts[2].trim() : '';

      if (term) {
        words.push({
          term,
          meaning,
          context: 'Chưa phân loại',
          specialty: 'Chung',
          example
        });
      }
    }
  }
  return words;
}

// Parsing CSV representation
function parseCSVData(text) {
  const lines = text.split('\n');
  const words = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (parts.length > 0) {
      const clean = parts.map(p => p.replace(/^"|"$/g, '').trim());
      const term = clean[0];
      const meaning = clean[1] || '';
      const example = clean[2] || '';

      if (term && term.toLowerCase() !== 'term' && term.toLowerCase() !== 'từ') {
        words.push({
          term,
          meaning,
          context: 'Chưa phân loại',
          specialty: 'Chung',
          example
        });
      }
    }
  }
  return words;
}

// Call Gemini API to extract and classify vocab
async function parseVocabularyWithGemini(documentText, apiKey) {
  const prompt = `
Bạn là một chuyên gia ngôn ngữ học và biên dịch viên chuyên nghiệp. Nhiệm vụ của bạn là đọc kỹ tài liệu văn bản được cung cấp bên dưới, sau đó trích xuất ra tất cả các từ vựng, thuật ngữ quan trọng (tiếng Anh).
Đối với mỗi từ vựng/thuật ngữ trích xuất được, hãy phân tích và xác định:
1. Từ/Thuật ngữ (term - tiếng Anh nguyên bản).
2. Định nghĩa/Nghĩa tiếng Việt (meaning - dịch chính xác theo ngữ cảnh của tài liệu).
3. Hoàn cảnh sử dụng (context - mô tả ngắn bằng tiếng Việt ngữ cảnh cụ thể từ này xuất hiện trong tài liệu, ví dụ: 'Thỏa thuận hợp đồng', 'Thuyết trình dự án', 'Giao dịch ngân hàng', 'Khám sức khỏe', 'Mô tả công việc').
4. Chuyên ngành (specialty - xếp vào một chuyên ngành học thuật/nghề nghiệp cụ thể bằng tiếng Việt, ví dụ: 'Luật', 'Tài chính', 'Nhân sự', 'Công nghệ thông tin', 'Thương mại', 'Y tế', 'Marketing', 'Sản xuất').
5. Ví dụ sử dụng (example - một câu ví dụ tiếng Anh có chứa từ này và có dịch nghĩa tiếng Việt đi kèm, ví dụ: "We signed a new contract today. (Chúng tôi đã ký một hợp đồng mới hôm nay.)").

Hãy tự động đề xuất một tên chủ đề ngắn gọn, súc tích đại diện cho bộ tài liệu này (đặt vào khóa "topicName").

Yêu cầu định dạng trả về:
BẮT BUỘC trả về dữ liệu dưới dạng JSON thuần túy (không bọc trong khối code markdown \`\`\`json ... \`\`\`, không chứa bất kỳ lời dẫn hay giải thích nào khác ngoài chuỗi JSON này). JSON phải tuân thủ nghiêm ngặt cấu trúc sau:
{
  "topicName": "Tên chủ đề được đề xuất",
  "words": [
    {
      "term": "Từ tiếng Anh",
      "meaning": "Nghĩa tiếng Việt",
      "context": "Hoàn cảnh sử dụng",
      "specialty": "Chuyên ngành",
      "example": "Câu ví dụ tiếng Anh. (Dịch nghĩa tiếng Việt.)"
    }
  ]
}

Nội dung tài liệu cần phân tích:
----------------------------------------
${documentText}
----------------------------------------
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    throw new Error("Không nhận được phản hồi hợp lệ từ Gemini API.");
  }

  try {
    return JSON.parse(textResponse.trim());
  } catch (e) {
    console.error("Failed to parse JSON response from Gemini API:", textResponse);
    throw new Error("Dữ liệu phản hồi từ AI không đúng định dạng JSON yêu cầu.");
  }
}

// -------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------

// 1. GET /api/dashboard - Get stats for active dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    const todayStr = getTodayString();

    // Word counts
    const totalWordsRow = await db.get("SELECT COUNT(*) as count FROM words WHERE archived = 0");
    const totalWords = totalWordsRow.count;

    // Mastered count (Level 4)
    const masteredRow = await db.get("SELECT COUNT(*) as count FROM learning_state ls JOIN words w ON ls.word_id = w.id WHERE ls.level = 4 AND w.archived = 0");
    const masteredCount = masteredRow.count;

    // Active topics count
    const activeTopicsRow = await db.get("SELECT COUNT(*) as count FROM topics WHERE archived = 0");
    const activeTopicsCount = activeTopicsRow.count;

    // SRS level distribution
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const srsRows = await db.all(`
      SELECT COALESCE(ls.level, 0) as level, COUNT(*) as count 
      FROM words w 
      LEFT JOIN learning_state ls ON w.id = ls.word_id 
      WHERE w.archived = 0 
      GROUP BY level
    `);
    srsRows.forEach(r => {
      if (r.level >= 0 && r.level <= 4) {
        distribution[r.level] = r.count;
      }
    });

    // Count due words today
    // Due condition: no state (level 0/new) OR next_review <= today
    const dueRow = await db.get(`
      SELECT COUNT(*) as count FROM words w
      LEFT JOIN learning_state ls ON w.id = ls.word_id
      WHERE w.archived = 0 AND (ls.word_id IS NULL OR ls.next_review <= ?)
    `, [todayStr]);
    const dueCount = dueRow.count;

    // Calculate streak
    const streak = await updateAndGetStreak();

    // Get list of specialties with word counts
    const specialties = await db.all(`
      SELECT COALESCE(specialty, 'Chung') as name, COUNT(*) as count 
      FROM words 
      WHERE archived = 0 
      GROUP BY specialty 
      ORDER BY count DESC
    `);

    // Get list of contexts with word counts
    const contexts = await db.all(`
      SELECT COALESCE(context, 'Chưa phân loại') as name, COUNT(*) as count 
      FROM words 
      WHERE archived = 0 
      GROUP BY context 
      ORDER BY count DESC
    `);

    res.json({
      totalWords,
      activeTopicsCount,
      masteredCount,
      dueCount,
      streak,
      distribution,
      specialties,
      contexts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi tải dữ liệu dashboard' });
  }
});

// 2. GET /api/topics - List all active topics
app.get('/api/topics', async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM topics WHERE archived = 0 ORDER BY added_at DESC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy danh sách chủ đề' });
  }
});

// 3. GET /api/topics/:id/words - Get words by topic
app.get('/api/topics/:id/words', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT w.*, COALESCE(ls.level, 0) as srsLevel 
      FROM words w 
      LEFT JOIN learning_state ls ON w.id = ls.word_id 
      WHERE w.topic_id = ? AND w.archived = 0
    `, [req.params.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy từ vựng theo chủ đề' });
  }
});

// 4. GET /api/words/by-specialty/:specialty - Get words by specialty
app.get('/api/words/by-specialty/:specialty', async (req, res) => {
  try {
    const specialty = req.params.specialty;
    const rows = await db.all(`
      SELECT w.*, COALESCE(ls.level, 0) as srsLevel 
      FROM words w 
      LEFT JOIN learning_state ls ON w.id = ls.word_id 
      WHERE w.specialty = ? AND w.archived = 0
    `, [specialty]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy từ vựng theo chuyên ngành' });
  }
});

// 5. GET /api/words/by-context/:context - Get words by context
app.get('/api/words/by-context/:context', async (req, res) => {
  try {
    const context = req.params.context;
    const rows = await db.all(`
      SELECT w.*, COALESCE(ls.level, 0) as srsLevel 
      FROM words w 
      LEFT JOIN learning_state ls ON w.id = ls.word_id 
      WHERE w.context = ? AND w.archived = 0
    `, [context]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy từ vựng theo hoàn cảnh' });
  }
});

// 6. GET /api/review-session - Select dynamic session words (Max 20) with Interleaved Recall
app.get('/api/review-session', async (req, res) => {
  try {
    const todayStr = getTodayString();
    const { topicId, specialty, context, limit = 20 } = req.query;

    let query = `
      SELECT w.*, COALESCE(ls.level, 0) as srsLevel, ls.next_review 
      FROM words w 
      LEFT JOIN learning_state ls ON w.id = ls.word_id 
      WHERE w.archived = 0
    `;
    const params = [];

    if (topicId) {
      query += ` AND w.topic_id = ?`;
      params.push(topicId);
    } else if (specialty) {
      query += ` AND w.specialty = ?`;
      params.push(specialty);
    } else if (context) {
      query += ` AND w.context = ?`;
      params.push(context);
    }

    const allWords = await db.all(query, params);

    if (allWords.length === 0) {
      return res.json([]);
    }

    const newWords = [];
    const dueWords = [];
    const reviewBufferWords = []; // Gối đầu

    allWords.forEach(word => {
      if (!word.next_review) {
        word.sessionType = 'NEW';
        newWords.push(word);
      } else {
        if (word.next_review <= todayStr) {
          word.sessionType = 'DUE';
          dueWords.push(word);
        } else if (word.srsLevel < 3) {
          word.sessionType = 'REVIEW_BUFFER';
          reviewBufferWords.push(word);
        }
      }
    });

    // Shuffle pools
    shuffle(newWords);
    shuffle(dueWords);
    shuffle(reviewBufferWords);

    // Quotas: 40% Due, 30% Gối đầu, 30% Mới
    const limitInt = parseInt(limit);
    const targetDue = Math.ceil(limitInt * 0.4);
    const targetReview = Math.ceil(limitInt * 0.3);
    const targetNew = limitInt - targetDue - targetReview;

    const selected = [];

    // Add due words
    selected.push(...dueWords.splice(0, targetDue));
    // Add review buffer
    selected.push(...reviewBufferWords.splice(0, targetReview));
    // Add new
    selected.push(...newWords.splice(0, targetNew));

    // Fill remaining quota
    const remainingQuota = limitInt - selected.length;
    if (remainingQuota > 0) {
      const fallbackPool = [...dueWords, ...reviewBufferWords, ...newWords];
      shuffle(fallbackPool);
      selected.push(...fallbackPool.splice(0, remainingQuota));
    }

    res.json(selected.slice(0, limitInt));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi tạo phiên ôn tập' });
  }
});

// 7. POST /api/review - Record review result (SRS Scheduler)
const SRS_INTERVALS = {
  0: 0,  // Today
  1: 1,  // +1 day
  2: 3,  // +3 days
  3: 7,  // +7 days
  4: 14  // +14 days
};

app.post('/api/review', async (req, res) => {
  try {
    const { wordId, correct } = req.body;
    if (!wordId) {
      return res.status(400).json({ error: 'Thiếu wordId' });
    }

    const todayStr = getTodayString();

    // Get current learning state
    let state = await db.get("SELECT * FROM learning_state WHERE word_id = ?", [wordId]);
    if (!state) {
      state = { word_id: wordId, level: 0, last_reviewed: null, next_review: todayStr };
    }

    // Calculate new level
    let newLevel = state.level;
    if (correct) {
      newLevel = Math.min(4, state.level + 1);
    } else {
      newLevel = Math.max(0, state.level - 1);
    }

    // Calculate next review date
    const offsetDays = SRS_INTERVALS[newLevel];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + offsetDays);
    const nextReviewStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

    // Update DB (Write-guard concept: safe isolated update)
    await db.run(`
      INSERT INTO learning_state (word_id, level, last_reviewed, next_review) 
      VALUES (?, ?, ?, ?)
      ON CONFLICT(word_id) DO UPDATE SET 
        level = excluded.level, 
        last_reviewed = excluded.last_reviewed, 
        next_review = excluded.next_review
    `, [wordId, newLevel, todayStr, nextReviewStr]);

    // Log daily review
    await db.run(`
      INSERT INTO daily_log (date, count) 
      VALUES (?, 1)
      ON CONFLICT(date) DO UPDATE SET count = count + 1
    `, [todayStr]);

    const newStreak = await updateAndGetStreak();

    res.json({
      success: true,
      newLevel,
      nextReview: nextReviewStr,
      streak: newStreak
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi ghi nhận tiến trình học' });
  }
});

// 8. Settings API
app.get('/api/settings', async (req, res) => {
  try {
    const apiKey = await getGeminiApiKey();
    res.json({ hasApiKey: !!apiKey });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy cài đặt' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { geminiApiKey } = req.body;
    if (geminiApiKey !== undefined) {
      await db.run("INSERT INTO settings (key, value) VALUES ('gemini_api_key', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [geminiApiKey]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lưu cài đặt' });
  }
});

// 9. Manual Import API
app.post('/api/import-manual', async (req, res) => {
  try {
    const { topicName, content, source = 'Manual Import' } = req.body;

    if (!topicName || !content) {
      return res.status(400).json({ error: 'Vui lòng cung cấp tên chủ đề và nội dung từ vựng' });
    }

    let words = [];
    if (content.trim().startsWith('{')) {
      try {
        const json = JSON.parse(content);
        if (json.words && Array.isArray(json.words)) {
          words = json.words.map(w => ({
            term: w.term,
            meaning: w.meaning,
            context: w.context || 'Chung',
            specialty: w.specialty || 'Chung',
            example: w.example || ''
          }));
        }
      } catch (e) {
        // ignore JSON fail, try txt
      }
    }

    if (words.length === 0) {
      if (content.includes(',') && !content.includes(' - ')) {
        words = parseCSVData(content);
      } else {
        words = parseTextData(content);
      }
    }

    if (words.length === 0) {
      return res.status(400).json({ error: 'Không trích xuất được từ vựng nào từ nội dung nhập' });
    }

    const topicId = 't_' + Math.random().toString(36).substring(2, 9);
    await db.run(
      "INSERT INTO topics (id, name, source, word_count, added_at) VALUES (?, ?, ?, ?, ?)",
      [topicId, topicName, source, words.length, new Date().toISOString()]
    );

    // Bulk insert words
    for (let w of words) {
      const wordId = 'w_' + Math.random().toString(36).substring(2, 9);
      await db.run(
        "INSERT INTO words (id, topic_id, term, meaning, context, specialty, example) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [wordId, topicId, w.term, w.meaning, w.context || 'Chung', w.specialty || 'Chung', w.example || '']
      );
    }

    res.json({ success: true, topicId, wordCount: words.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi xử lý import thủ công' });
  }
});

// 10. POST /api/upload-file - Process uploaded docx/pdf/txt/csv/json
app.post('/api/upload-file', upload.single('vocabFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không tìm thấy file tải lên.' });
    }

    const originalName = req.file.originalname;
    const fileExt = path.extname(originalName).toLowerCase();
    let textContent = '';

    // Extract text from file buffer
    if (fileExt === '.txt' || fileExt === '.csv' || fileExt === '.json') {
      textContent = req.file.buffer.toString('utf8');
    } else if (fileExt === '.docx') {
      const docResult = await mammoth.extractRawText({ buffer: req.file.buffer });
      textContent = docResult.value;
    } else if (fileExt === '.pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      textContent = pdfData.text;
    } else {
      return res.status(400).json({ error: 'Định dạng file không được hỗ trợ. Hãy tải lên file .txt, .csv, .json, .docx hoặc .pdf' });
    }

    if (!textContent.trim()) {
      return res.status(400).json({ error: 'Tài liệu tải lên không chứa dữ liệu văn bản trống.' });
    }

    // Try JSON parse directly if it is a JSON file
    if (fileExt === '.json') {
      try {
        const json = JSON.parse(textContent);
        const topicName = json.topicName || originalName.replace(/\.[^/.]+$/, "");
        const words = json.words || [];

        if (words.length > 0) {
          const topicId = 't_' + Math.random().toString(36).substring(2, 9);
          await db.run(
            "INSERT INTO topics (id, name, source, word_count, added_at) VALUES (?, ?, ?, ?, ?)",
            [topicId, topicName, originalName, words.length, new Date().toISOString()]
          );

          for (let w of words) {
            const wordId = 'w_' + Math.random().toString(36).substring(2, 9);
            await db.run(
              "INSERT INTO words (id, topic_id, term, meaning, context, specialty, example) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [wordId, topicId, w.term, w.meaning, w.context || 'Chung', w.specialty || 'Chung', w.example || '']
            );
          }
          return res.json({ success: true, topicName, wordCount: words.length });
        }
      } catch (e) {
        // Fall back to general parsing
      }
    }

    // If it's a simple formatted list, parse directly to save API tokens
    // But if we want proper specialty & context classification, we should use Gemini
    const apiKey = await getGeminiApiKey();

    if (!apiKey) {
      // Fallback: Parse offline without Gemini (defaulting context and specialty)
      let words = [];
      if (fileExt === '.csv') {
        words = parseCSVData(textContent);
      } else {
        words = parseTextData(textContent);
      }

      if (words.length === 0) {
        return res.status(400).json({ error: 'Không thể phân tích từ vựng tự động. Hãy cung cấp API Key của Gemini để phân tích tài liệu phức tạp.' });
      }

      const topicName = originalName.replace(/\.[^/.]+$/, "");
      const topicId = 't_' + Math.random().toString(36).substring(2, 9);
      await db.run(
        "INSERT INTO topics (id, name, source, word_count, added_at) VALUES (?, ?, ?, ?, ?)",
        [topicId, topicName, originalName, words.length, new Date().toISOString()]
      );

      for (let w of words) {
        const wordId = 'w_' + Math.random().toString(36).substring(2, 9);
        await db.run(
          "INSERT INTO words (id, topic_id, term, meaning, context, specialty, example) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [wordId, topicId, w.term, w.meaning, 'Chung', 'Chung', w.example || '']
        );
      }

      return res.json({
        success: true,
        topicName,
        wordCount: words.length,
        warning: 'Đã phân tích ngoại tuyến (Chưa phân loại chuyên ngành & hoàn cảnh do thiếu API Key).'
      });
    }

    // Tải lên và phân loại bằng Gemini API
    const parsedData = await parseVocabularyWithGemini(textContent, apiKey);
    const words = parsedData.words || [];
    const topicName = parsedData.topicName || originalName.replace(/\.[^/.]+$/, "");

    if (words.length === 0) {
      return res.status(400).json({ error: 'AI không tìm thấy từ vựng nào phù hợp trong tài liệu này.' });
    }

    const topicId = 't_' + Math.random().toString(36).substring(2, 9);
    await db.run(
      "INSERT INTO topics (id, name, source, word_count, added_at) VALUES (?, ?, ?, ?, ?)",
      [topicId, topicName, originalName, words.length, new Date().toISOString()]
    );

    for (let w of words) {
      const wordId = 'w_' + Math.random().toString(36).substring(2, 9);
      await db.run(
        "INSERT INTO words (id, topic_id, term, meaning, context, specialty, example) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [wordId, topicId, w.term, w.meaning, w.context || 'Chung', w.specialty || 'Chung', w.example || '']
      );
    }

    res.json({ success: true, topicName, wordCount: words.length });

  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ error: error.message || 'Lỗi xử lý file tải lên' });
  }
});

// 11. POST /api/reset - Clear database
app.post('/api/reset', async (req, res) => {
  try {
    await db.exec('DELETE FROM learning_state');
    await db.exec('DELETE FROM words');
    await db.exec('DELETE FROM topics');
    await db.exec('DELETE FROM daily_log');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi đặt lại cơ sở dữ liệu' });
  }
});

// Start DB and Express Server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Database connection failed:", err);
});
