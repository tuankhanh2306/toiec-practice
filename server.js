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

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for memory upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
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

  // Schema migrations for new columns
  const columns = await db.all("PRAGMA table_info(words)");
  const colNames = columns.map(c => c.name);
  if (!colNames.includes('starred')) {
    await db.exec("ALTER TABLE words ADD COLUMN starred INTEGER DEFAULT 0");
  }
  if (!colNames.includes('notes')) {
    await db.exec("ALTER TABLE words ADD COLUMN notes TEXT");
  }
  if (!colNames.includes('pos')) {
    await db.exec("ALTER TABLE words ADD COLUMN pos TEXT");
  }
  if (!colNames.includes('ipa')) {
    await db.exec("ALTER TABLE words ADD COLUMN ipa TEXT");
  }
  if (!colNames.includes('word_family')) {
    await db.exec("ALTER TABLE words ADD COLUMN word_family TEXT");
  }
  if (!colNames.includes('synonyms')) {
    await db.exec("ALTER TABLE words ADD COLUMN synonyms TEXT");
  }
  if (!colNames.includes('collocations')) {
    await db.exec("ALTER TABLE words ADD COLUMN collocations TEXT");
  }

  // Auto-enrich existing words by parsing POS & IPA from meaning text if present
  try {
    const unparsedWords = await db.all("SELECT id, term, meaning FROM words WHERE pos IS NULL OR ipa IS NULL");
    for (const w of unparsedWords) {
      if (!w.meaning) continue;
      let pos = null;
      let ipa = null;

      const posMatch = w.meaning.match(/\[(v|n|adj|adv|prep|conj|phrasal verb)\]/i);
      if (posMatch) {
        pos = posMatch[1].toLowerCase();
      }

      const ipaMatch = w.meaning.match(/(\/[^\/]+\/)/);
      if (ipaMatch) {
        ipa = ipaMatch[1];
      }

      if (pos || ipa) {
        await db.run("UPDATE words SET pos = COALESCE(pos, ?), ipa = COALESCE(ipa, ?) WHERE id = ?", [pos, ipa, w.id]);
      }
    }
  } catch (e) {
    console.error("Auto-enrichment error:", e);
  }

  // Create TOEIC Reading Part 5, 6, 7 tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reading_passages (
      id TEXT PRIMARY KEY,
      part INTEGER NOT NULL,
      title TEXT,
      passage_text TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reading_questions (
      id TEXT PRIMARY KEY,
      passage_id TEXT REFERENCES reading_passages(id) ON DELETE CASCADE,
      part INTEGER NOT NULL,
      question_number INTEGER DEFAULT 1,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL,
      question_type TEXT,
      translation TEXT,
      analysis TEXT,
      vocab_highlights TEXT
    );
  `);

  await seedReadingData();
}

async function seedReadingData() {
  const existingQuestions = await db.get("SELECT COUNT(*) as count FROM reading_questions");
  if (existingQuestions.count > 0) return;

  console.log("Seeding initial TOEIC Reading Part 5, 6, 7 sample questions...");

  // Part 5 Questions
  const part5Questions = [
    {
      id: 'rq_p5_1',
      passage_id: null,
      part: 5,
      question_number: 1,
      question_text: "The manager asked his team members what they hope to _______ this month.",
      option_a: "accomplishment",
      option_b: "accomplish",
      option_c: "accomplished",
      option_d: "accomplishing",
      correct_option: "B",
      question_type: "Word Form (Từ loại)",
      translation: "Trưởng phòng đã hỏi các thành viên trong đội những gì họ hy vọng hoàn thành trong tháng này.",
      analysis: "Sau cấu trúc động từ chỉ mong muốn 'hope to' cần một động từ nguyên mẫu (bare infinitive). Do đó phương án đúng là (B) accomplish (động từ nguyên mẫu). (A) là danh từ, (C) là quá khứ, (D) là V-ing.",
      vocab_highlights: JSON.stringify([
        { term: "accomplish", meaning: "hoàn thành, đạt được", pos: "verb", ipa: "/əˈkʌmplɪʃ/" },
        { term: "hope to do sth", meaning: "hy vọng làm điều gì", pos: "phrase", ipa: "" }
      ])
    },
    {
      id: 'rq_p5_2',
      passage_id: null,
      part: 5,
      question_number: 2,
      question_text: "All employees must submit their travel expense reports _______ Friday afternoon at 5 PM.",
      option_a: "until",
      option_b: "by",
      option_c: "for",
      option_d: "with",
      correct_option: "B",
      question_type: "Preposition (Giới từ)",
      translation: "Tất cả nhân viên phải nộp báo cáo chi phí đi lại trước 5 giờ chiều thứ Sáu.",
      analysis: "Giới từ 'by' chỉ hạn chót (thời điểm hoàn thành hành động). Phân biệt với 'until' dùng cho hành động duy trì liên tục cho tới mốc thời gian đó. Do đó chọn (B) by.",
      vocab_highlights: JSON.stringify([
        { term: "submit", meaning: "nộp (tài liệu, báo cáo)", pos: "verb", ipa: "/səbˈmɪt/" },
        { term: "expense report", meaning: "báo cáo chi phí", pos: "noun", ipa: "/ɪkˈspens rɪˈpɔːrt/" }
      ])
    },
    {
      id: 'rq_p5_3',
      passage_id: null,
      part: 5,
      question_number: 3,
      question_text: "The new software update is expected to _______ overall workplace productivity significantly.",
      option_a: "enhance",
      option_b: "delay",
      option_c: "reject",
      option_d: "withdraw",
      correct_option: "A",
      question_type: "Vocabulary (Từ vựng ngữ cảnh)",
      translation: "Bản cập nhật phần mềm mới được kỳ vọng sẽ nâng cao đáng kể năng suất làm việc tổng thể.",
      analysis: "Xét ngữ cảnh mang tính tích cực 'software update' và 'productivity', từ phù hợp nhất là (A) enhance (nâng cao, cải thiện). Các từ khác: (B) delay (trì hoãn), (C) reject (từ chối), (D) withdraw (rút tiền/rút lui).",
      vocab_highlights: JSON.stringify([
        { term: "enhance", meaning: "nâng cao, tăng cường", pos: "verb", ipa: "/ɪnˈhæns/" },
        { term: "productivity", meaning: "năng suất làm việc", pos: "noun", ipa: "/ˌproʊdʌkˈtɪvəti/" }
      ])
    }
  ];

  for (let q of part5Questions) {
    await db.run(`
      INSERT INTO reading_questions (id, passage_id, part, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, translation, analysis, vocab_highlights)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [q.id, q.passage_id, q.part, q.question_number, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.question_type, q.translation, q.analysis, q.vocab_highlights]);
  }

  // Part 6 Seed
  const passage6Id = 'rp_p6_1';
  await db.run(`
    INSERT INTO reading_passages (id, part, title, passage_text, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, [
    passage6Id,
    6,
    "Notice: Annual Performance Reviews",
    "To: Department Heads\nFrom: HR Department\nDate: October 12\nSubject: Annual Performance Reviews\n\nPlease be reminded that annual performance reviews for all staff members must be completed by November 15. [1] _______ reviews are essential for evaluating employee progress and determining promotion eligibility.\n\nForms can be downloaded from the company intranet. Please ensure that all sections are [2] _______ filled out before final submission. If you have questions, please contact HR.",
    new Date().toISOString()
  ]);

  await db.run(`
    INSERT INTO reading_questions (id, passage_id, part, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, translation, analysis, vocab_highlights)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'rq_p6_1', passage6Id, 6, 1, "Select the best word to fill in blank [1].",
    "These", "This", "That", "Them", "A", "Pronoun / Determiner",
    "Dịch: Những buổi đánh giá này là rất cần thiết để đánh giá sự tiến bộ của nhân viên.",
    "Từ 'reviews' phía sau là danh từ số nhiều, nên đại từ chỉ định thay thế phải ở dạng số nhiều -> chọn (A) These.",
    JSON.stringify([
      { term: "performance review", meaning: "đánh giá hiệu suất làm việc", pos: "noun", ipa: "/pərˈfɔːrməns rɪˈvjuː/" },
      { term: "eligibility", meaning: "tư cách, sự đủ điều kiện", pos: "noun", ipa: "/ˌelɪdʒəˈbɪləti/" }
    ])
  ]);

  await db.run(`
    INSERT INTO reading_questions (id, passage_id, part, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, translation, analysis, vocab_highlights)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'rq_p6_2', passage6Id, 6, 2, "Select the best word to fill in blank [2].",
    "complete", "completely", "completion", "completing", "B", "Word Form (Phó từ)",
    "Dịch: Vui lòng đảm bảo rằng tất cả các phần được điền một cách hoàn chỉnh trước khi nộp.",
    "Cụm 'filled out' là một cụm động từ (phân từ hai), từ đứng trước bổ nghĩa cho động từ/tính từ phải là một trạng từ/phó từ (-ly) -> chọn (B) completely.",
    JSON.stringify([
      { term: "filled out", meaning: "điền đầy đủ (vào mẫu đơn)", pos: "verb", ipa: "/fɪld aʊt/" },
      { term: "submission", meaning: "sự nộp bài, sự đệ trình", pos: "noun", ipa: "/səbˈmɪʃn/" }
    ])
  ]);

  // Part 7 Seed
  const passage7Id = 'rp_p7_1';
  await db.run(`
    INSERT INTO reading_passages (id, part, title, passage_text, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, [
    passage7Id,
    7,
    "Memorandum: Office Renovation Project",
    "MEMORANDUM\n\nTo: All Staff, Apex Financial Solutions\nFrom: Facility Management Team\nDate: March 5\nSubject: Headquarters Renovation Project\n\nWe are pleased to announce that the renovation of our 4th floor conference center will begin next Monday, March 10. The project is expected to take approximately three weeks to complete.\n\nDuring this period, all scheduled department meetings will be relocated to the 2nd floor training rooms. We apologize for any temporary inconvenience this may cause and appreciate your cooperation in keeping noise levels to a minimum.",
    new Date().toISOString()
  ]);

  await db.run(`
    INSERT INTO reading_questions (id, passage_id, part, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, translation, analysis, vocab_highlights)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'rq_p7_1', passage7Id, 7, 1, "What is the main purpose of the memorandum?",
    "To announce an upcoming renovation", "To hire new facility managers", "To cancel next week's meetings", "To change office working hours",
    "A", "Main Idea (Ý chính)",
    "Dịch: Mục đích chính của bản ghi nhớ này là gì? -> Để thông báo về một dự án cải tạo sắp tới.",
    "Đoạn thứ nhất nêu rõ: 'We are pleased to announce that the renovation of our 4th floor conference center will begin next Monday...'. Do đó đáp án đúng là (A).",
    JSON.stringify([
      { term: "renovation", meaning: "sự cải tạo, nâng cấp", pos: "noun", ipa: "/ˌrenəˈveɪʃn/" },
      { term: "approximately", meaning: "khoảng, xấp xỉ", pos: "adv", ipa: "/əˈprɑːksɪmətli/" }
    ])
  ]);

  await db.run(`
    INSERT INTO reading_questions (id, passage_id, part, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, question_type, translation, analysis, vocab_highlights)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'rq_p7_2', passage7Id, 7, 2, "Where will department meetings take place during the renovation?",
    "On the 4th floor", "On the 2nd floor", "At a nearby hotel", "In the main lobby",
    "B", "Detail Info (Thông tin chi tiết)",
    "Dịch: Các cuộc họp phòng ban sẽ diễn ra ở đâu trong thời gian cải tạo? -> Ở tầng 2.",
    "Đoạn thứ hai khẳng định: 'all scheduled department meetings will be relocated to the 2nd floor training rooms'. Do đó đáp án đúng là (B) On the 2nd floor.",
    JSON.stringify([
      { term: "relocate", meaning: "di dời sang vị trí mới", pos: "verb", ipa: "/ˌriːˈloʊkeɪt/" },
      { term: "inconvenience", meaning: "sự bất tiện", pos: "noun", ipa: "/ˌɪnkənˈviːniəns/" }
    ])
  ]);
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

// Call Gemini API to extract and classify vocab with linguistic attributes
async function parseVocabularyWithGemini(documentText, apiKey) {
  const prompt = `
Bạn là một chuyên gia ngôn ngữ học và biên dịch viên luyện thi TOEIC chuyên nghiệp. Nhiệm vụ của bạn là đọc kỹ tài liệu văn bản được cung cấp bên dưới, sau đó trích xuất ra tất cả các từ vựng, thuật ngữ quan trọng (tiếng Anh).
Đối với mỗi từ vựng/thuật ngữ trích xuất được, hãy phân tích chuyên sâu các trường thuộc tính ngôn ngữ sau:
1. Từ/Thuật ngữ (term - tiếng Anh nguyên bản).
2. Phiên âm IPA (ipa - ví dụ: '/əˈkʌmplɪʃ/').
3. Từ loại (pos - ví dụ: 'verb', 'noun', 'adj', 'adv', 'phrasal verb').
4. Định nghĩa/Nghĩa tiếng Việt (meaning - dịch chính xác theo ngữ cảnh của tài liệu).
5. Từ đồng nghĩa / Paraphrasing (synonyms - từ/cụm từ đồng nghĩa phổ biến trong TOEIC, ví dụ: 'achieve, fulfill, complete').
6. Cụm từ cố định / Kết hợp từ (collocations - các cụm từ hay đi kèm trong doanh nghiệp, ví dụ: 'accomplish a task/goal').
7. Họ từ loại (word_family - dạng danh từ, động từ, tính từ liên quan, ví dụ: 'N: accomplishment | Adj: accomplished').
8. Hoàn cảnh sử dụng (context - ví dụ: 'Thỏa thuận hợp đồng', 'Tuyển dụng', 'Giao dịch ngân hàng').
9. Chuyên ngành (specialty - ví dụ: 'Luật', 'Tài chính', 'Nhân sự', 'Thương mại').
10. Ví dụ sử dụng (example - một câu ví dụ tiếng Anh có chứa từ này và có dịch nghĩa tiếng Việt đi kèm).

Hãy tự động đề xuất một tên chủ đề ngắn gọn, súc tích đại diện cho bộ tài liệu này (đặt vào khóa "topicName").

Yêu cầu định dạng trả về:
BẮT BUỘC trả về dữ liệu dưới dạng JSON thuần túy (không bọc trong khối code markdown \`\`\`json ... \`\`\`, không chứa bất kỳ lời dẫn hay giải thích nào khác ngoài chuỗi JSON này). JSON phải tuân thủ nghiêm ngặt cấu trúc sau:
{
  "topicName": "Tên chủ đề được đề xuất",
  "words": [
    {
      "term": "Từ tiếng Anh",
      "ipa": "/phiên âm IPA/",
      "pos": "từ loại",
      "meaning": "Nghĩa tiếng Việt",
      "synonyms": "từ đồng nghĩa",
      "collocations": "cụm kết hợp từ",
      "word_family": "họ từ loại",
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

// 7. POST /api/review - Record review result (Enhanced SRS Scheduler SM-2/Anki)
const SRS_INTERVALS = {
  0: 0,  // Today
  1: 1,  // +1 day
  2: 3,  // +3 days
  3: 7,  // +7 days
  4: 14  // +14 days
};

app.post('/api/review', async (req, res) => {
  try {
    const { wordId, rating, correct } = req.body;
    if (!wordId) {
      return res.status(400).json({ error: 'Thiếu wordId' });
    }

    const todayStr = getTodayString();

    // Get current learning state
    let state = await db.get("SELECT * FROM learning_state WHERE word_id = ?", [wordId]);
    if (!state) {
      state = { word_id: wordId, level: 0, last_reviewed: null, next_review: todayStr };
    }

    let newLevel = state.level;
    let offsetDays = 0;

    if (rating) {
      // 4-level rating system (again, hard, good, easy)
      if (rating === 'again') {
        newLevel = 0;
        offsetDays = 0;
      } else if (rating === 'hard') {
        newLevel = Math.max(1, state.level);
        offsetDays = 1;
      } else if (rating === 'good') {
        newLevel = Math.min(4, state.level + 1);
        offsetDays = SRS_INTERVALS[newLevel] || 3;
      } else if (rating === 'easy') {
        newLevel = Math.min(4, state.level + 2);
        offsetDays = 14;
      }
    } else {
      // Fallback boolean correct
      if (correct) {
        newLevel = Math.min(4, state.level + 1);
      } else {
        newLevel = Math.max(0, state.level - 1);
      }
      offsetDays = SRS_INTERVALS[newLevel];
    }

    // Calculate next review date
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

// 8. GET /api/words/dictionary - Advanced word dictionary search & filter
app.get('/api/words/dictionary', async (req, res) => {
  try {
    const { search, srsLevel, starred, topicId, letter, limit = 100 } = req.query;

    let query = `
      SELECT w.*, COALESCE(ls.level, 0) as srsLevel, ls.next_review, t.name as topic_name
      FROM words w
      LEFT JOIN learning_state ls ON w.id = ls.word_id
      LEFT JOIN topics t ON w.topic_id = t.id
      WHERE w.archived = 0
    `;
    const params = [];

    if (search && search.trim()) {
      query += ` AND (w.term LIKE ? OR w.meaning LIKE ? OR w.context LIKE ? OR w.specialty LIKE ?)`;
      const termSearch = `%${search.trim()}%`;
      params.push(termSearch, termSearch, termSearch, termSearch);
    }

    if (srsLevel !== undefined && srsLevel !== '' && srsLevel !== 'all') {
      query += ` AND COALESCE(ls.level, 0) = ?`;
      params.push(parseInt(srsLevel));
    }

    if (starred === '1' || starred === 'true') {
      query += ` AND w.starred = 1`;
    }

    if (topicId) {
      query += ` AND w.topic_id = ?`;
      params.push(topicId);
    }

    if (letter && letter.trim()) {
      query += ` AND LOWER(SUBSTR(w.term, 1, 1)) = ?`;
      params.push(letter.trim().toLowerCase());
    }

    query += ` ORDER BY w.starred DESC, w.term ASC LIMIT ?`;
    params.push(parseInt(limit));

    const words = await db.all(query, params);
    res.json(words);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi tra cứu từ điển' });
  }
});

// 9. POST /api/words/:id/star - Toggle starred state
app.post('/api/words/:id/star', async (req, res) => {
  try {
    const wordId = req.params.id;
    const word = await db.get("SELECT starred FROM words WHERE id = ?", [wordId]);
    if (!word) {
      return res.status(404).json({ error: 'Không tìm thấy từ vựng' });
    }

    const newStarred = word.starred ? 0 : 1;
    await db.run("UPDATE words SET starred = ? WHERE id = ?", [newStarred, wordId]);

    res.json({ success: true, starred: newStarred });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi cập nhật yêu thích' });
  }
});

// 10. PUT /api/words/:id - Update word details/notes/linguistic info
app.put('/api/words/:id', async (req, res) => {
  try {
    const wordId = req.params.id;
    const { meaning, example, notes, context, specialty, pos, ipa, word_family, synonyms, collocations } = req.body;

    await db.run(`
      UPDATE words 
      SET meaning = COALESCE(?, meaning),
          example = COALESCE(?, example),
          notes = COALESCE(?, notes),
          context = COALESCE(?, context),
          specialty = COALESCE(?, specialty),
          pos = COALESCE(?, pos),
          ipa = COALESCE(?, ipa),
          word_family = COALESCE(?, word_family),
          synonyms = COALESCE(?, synonyms),
          collocations = COALESCE(?, collocations)
      WHERE id = ?
    `, [meaning, example, notes, context, specialty, pos, ipa, word_family, synonyms, collocations, wordId]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi cập nhật từ vựng' });
  }
});

// 11. GET /api/cloze-session - Fill-in-the-blanks session (Cloze Test)
app.get('/api/cloze-session', async (req, res) => {
  try {
    const { limit = 15 } = req.query;

    const words = await db.all(`
      SELECT w.*, COALESCE(ls.level, 0) as srsLevel
      FROM words w
      LEFT JOIN learning_state ls ON w.id = ls.word_id
      WHERE w.archived = 0 AND w.example IS NOT NULL AND LENGTH(w.example) > 10
      ORDER BY RANDOM()
      LIMIT ?
    `, [parseInt(limit)]);

    if (words.length === 0) {
      return res.json([]);
    }

    // Prepare distractor choices from general word pool
    const allWords = await db.all("SELECT term FROM words WHERE archived = 0 LIMIT 200");
    const termPool = allWords.map(w => w.term);

    const questions = words.map(word => {
      let exampleText = word.example;
      // Extract English part if example contains Vietnamese translation in parentheses
      let engExample = exampleText;
      let vieTrans = '';
      const matchParen = exampleText.match(/^(.*?)\s*\((.*?)\)$/);
      if (matchParen) {
        engExample = matchParen[1];
        vieTrans = matchParen[2];
      }

      // Escape special characters in term for regex replacement
      const termRegex = new RegExp(`\\b${word.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      let maskedSentence = engExample;
      if (termRegex.test(engExample)) {
        maskedSentence = engExample.replace(termRegex, '_______');
      } else {
        // Fallback replacement if exact boundary match fails
        maskedSentence = engExample.replace(new RegExp(word.term, 'gi'), '_______');
      }

      // Build options (1 correct + 3 distractors)
      const options = [word.term];
      const otherTerms = termPool.filter(t => t.toLowerCase() !== word.term.toLowerCase());
      shuffle(otherTerms);
      for (let i = 0; i < Math.min(3, otherTerms.length); i++) {
        options.push(otherTerms[i]);
      }
      shuffle(options);

      return {
        id: word.id,
        maskedSentence,
        fullSentence: engExample,
        vietnameseTranslation: vieTrans,
        correctTerm: word.term,
        meaning: word.meaning,
        options,
        srsLevel: word.srsLevel
      };
    });

    res.json(questions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi tạo bài tập điền từ' });
  }
});

// 12. GET /api/review-forecast - Due words forecast for next 7 days
app.get('/api/review-forecast', async (req, res) => {
  try {
    const today = new Date();
    const forecast = [];

    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + i);
      const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

      let countRow;
      if (i === 0) {
        // Today due (level 0 or next_review <= today)
        countRow = await db.get(`
          SELECT COUNT(*) as count FROM words w
          LEFT JOIN learning_state ls ON w.id = ls.word_id
          WHERE w.archived = 0 AND (ls.word_id IS NULL OR ls.next_review <= ?)
        `, [dateStr]);
      } else {
        // Exact target date review
        countRow = await db.get(`
          SELECT COUNT(*) as count FROM words w
          JOIN learning_state ls ON w.id = ls.word_id
          WHERE w.archived = 0 AND ls.next_review = ?
        `, [dateStr]);
      }

      forecast.push({
        dayLabel: i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : `+${i} ngày`,
        date: dateStr,
        count: countRow ? countRow.count : 0
      });
    }

    res.json(forecast);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi tạo dự báo ôn tập' });
  }
});

// -------------------------------------------------------------
// TOEIC READING PART 5, 6, 7 API ENDPOINTS
// -------------------------------------------------------------

// 13. GET /api/reading/session - Get reading questions by Part (5, 6, 7)
app.get('/api/reading/session', async (req, res) => {
  try {
    const { part = 5, limit = 10 } = req.query;
    const partNum = parseInt(part);

    if (partNum === 5) {
      const questions = await db.all(
        "SELECT * FROM reading_questions WHERE part = 5 ORDER BY RANDOM() LIMIT ?",
        [parseInt(limit)]
      );
      return res.json({ type: 'single', questions });
    } else {
      // For Part 6 & 7, fetch passages along with their questions
      const passages = await db.all(
        "SELECT * FROM reading_passages WHERE part = ? ORDER BY RANDOM() LIMIT ?",
        [partNum, Math.max(1, Math.floor(limit / 2))]
      );

      for (let passage of passages) {
        const pQuestions = await db.all(
          "SELECT * FROM reading_questions WHERE passage_id = ? ORDER BY question_number ASC",
          [passage.id]
        );
        passage.questions = pQuestions;
      }
      return res.json({ type: 'passage', passages });
    }
  } catch (error) {
    console.error("Reading session error:", error);
    res.status(500).json({ error: 'Lỗi tải bài luyện đọc TOEIC' });
  }
});

// 14. POST /api/reading/submit - Submit answers and return detailed explanations
app.post('/api/reading/submit', async (req, res) => {
  try {
    const { answers } = req.body; // Array of { questionId, selectedOption }
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Dữ liệu bài làm không hợp lệ' });
    }

    let correctCount = 0;
    const results = [];

    for (let ans of answers) {
      const q = await db.get("SELECT * FROM reading_questions WHERE id = ?", [ans.questionId]);
      if (!q) continue;

      const isCorrect = q.correct_option.toUpperCase() === (ans.selectedOption || '').toUpperCase();
      if (isCorrect) correctCount++;

      let vocabHighlights = [];
      try {
        if (q.vocab_highlights) vocabHighlights = JSON.parse(q.vocab_highlights);
      } catch (e) {}

      results.push({
        questionId: q.id,
        questionText: q.question_text,
        userOption: ans.selectedOption,
        correctOption: q.correct_option,
        isCorrect,
        questionType: q.question_type || 'General',
        translation: q.translation || '',
        analysis: q.analysis || '',
        options: {
          A: q.option_a,
          B: q.option_b,
          C: q.option_c,
          D: q.option_d
        },
        vocabHighlights
      });
    }

    res.json({
      total: results.length,
      correctCount,
      scorePct: Math.round((correctCount / (results.length || 1)) * 100),
      results
    });
  } catch (error) {
    console.error("Reading submit error:", error);
    res.status(500).json({ error: 'Lỗi chấm bài đọc TOEIC' });
  }
});

// 15. POST /api/reading/add-vocab-to-srs - Extract vocab from explanation into SRS queue
app.post('/api/reading/add-vocab-to-srs', async (req, res) => {
  try {
    const { term, meaning, pos, ipa, example } = req.body;
    if (!term || !meaning) {
      return res.status(400).json({ error: 'Thiếu thông tin từ vựng' });
    }

    // Check if word exists
    const existing = await db.get("SELECT id FROM words WHERE LOWER(term) = LOWER(?)", [term.trim()]);
    if (existing) {
      return res.json({ success: true, wordId: existing.id, message: 'Từ này đã có trong bộ sưu tập!' });
    }

    // Find default TOEIC reading topic or create one
    let topic = await db.get("SELECT id FROM topics WHERE name = 'Từ Vựng Rút Ra Từ Bài Đọc TOEIC'");
    if (!topic) {
      const topicId = 't_reading_vocab';
      await db.run(
        "INSERT INTO topics (id, name, source, word_count, added_at) VALUES (?, ?, ?, 1, ?)",
        [topicId, "Từ Vựng Rút Ra Từ Bài Đọc TOEIC", "TOEIC Reading Explanations", new Date().toISOString()]
      );
      topic = { id: topicId };
    } else {
      await db.run("UPDATE topics SET word_count = word_count + 1 WHERE id = ?", [topic.id]);
    }

    const wordId = 'w_read_' + Math.random().toString(36).substring(2, 9);
    await db.run(`
      INSERT INTO words (id, topic_id, term, meaning, context, specialty, example, pos, ipa)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [wordId, topic.id, term.trim(), meaning.trim(), 'TOEIC Reading', 'TOEIC Exam', example || '', pos || null, ipa || null]);

    res.json({ success: true, wordId, message: `Đã thêm từ "${term}" vào kho học SRS!` });
  } catch (error) {
    console.error("Add vocab SRS error:", error);
    res.status(500).json({ error: 'Lỗi thêm từ vựng vào SRS' });
  }
});

// 13. GET /api/export-backup - Export database backup
app.get('/api/export-backup', async (req, res) => {
  try {
    const topics = await db.all("SELECT * FROM topics");
    const words = await db.all("SELECT * FROM words");
    const learningState = await db.all("SELECT * FROM learning_state");
    const dailyLog = await db.all("SELECT * FROM daily_log");
    const settings = await db.all("SELECT * FROM settings");

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=toeic-backup-${getTodayString()}.json`);
    res.json({
      version: "1.0",
      exportedAt: new Date().toISOString(),
      topics,
      words,
      learningState,
      dailyLog,
      settings
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi xuất file sao lưu' });
  }
});

// 14. POST /api/import-backup - Restore database backup
app.post('/api/import-backup', async (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || !backupData.topics || !backupData.words) {
      return res.status(400).json({ error: 'File sao lưu không hợp lệ.' });
    }

    await db.exec('DELETE FROM learning_state');
    await db.exec('DELETE FROM words');
    await db.exec('DELETE FROM topics');
    await db.exec('DELETE FROM daily_log');

    for (let t of backupData.topics) {
      await db.run("INSERT INTO topics (id, name, source, word_count, added_at, archived) VALUES (?, ?, ?, ?, ?, ?)",
        [t.id, t.name, t.source, t.word_count, t.added_at, t.archived || 0]);
    }

    for (let w of backupData.words) {
      await db.run("INSERT INTO words (id, topic_id, term, meaning, context, specialty, example, archived, starred, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [w.id, w.topic_id, w.term, w.meaning, w.context, w.specialty, w.example, w.archived || 0, w.starred || 0, w.notes || null]);
    }

    if (backupData.learningState) {
      for (let ls of backupData.learningState) {
        await db.run("INSERT INTO learning_state (word_id, level, last_reviewed, next_review) VALUES (?, ?, ?, ?)",
          [ls.word_id, ls.level, ls.last_reviewed, ls.next_review]);
      }
    }

    if (backupData.dailyLog) {
      for (let dl of backupData.dailyLog) {
        await db.run("INSERT INTO daily_log (date, count) VALUES (?, ?)", [dl.date, dl.count]);
      }
    }

    res.json({ success: true, wordCount: backupData.words.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi khôi phục dữ liệu từ file sao lưu' });
  }
});

// Settings API
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
      return res.status(400).json({ error: 'Tài liệu tải lên không có nội dung chữ đọc được (Nếu là file PDF, có thể đây là tệp ảnh scan không có lớp text).' });
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
        "INSERT INTO words (id, topic_id, term, meaning, context, specialty, example, pos, ipa, word_family, synonyms, collocations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [wordId, topicId, w.term, w.meaning, w.context || 'Chung', w.specialty || 'Chung', w.example || '', w.pos || null, w.ipa || null, w.word_family || null, w.synonyms || null, w.collocations || null]
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
