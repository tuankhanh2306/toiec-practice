/**
 * import_from_xlsx.js
 * Xóa toàn bộ dữ liệu cũ và import lại từ file Excel 3 sheet:
 *   Sheet "Part 5" → topic_id = "t_part5"
 *   Sheet "Part 6" → topic_id = "t_part6"
 *   Sheet "Part 7" → topic_id = "t_part7"  (đổi từ t_toeic204 → t_part7 cho đồng nhất)
 */

const XLSX = require('xlsx');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const EXCEL_FILE = 'Bản sao của THE DAILY ENGLISH_Vocabulary_Sheet.xlsx';
const DB_FILE = path.join(__dirname, 'database.sqlite');

// Mapping: sheet name → topic config
const SHEET_MAP = {
  'Part 5': {
    id: 't_part5',
    name: 'Part 5 – Collocations & Structures',
    source: 'THE DAILY ENGLISH Vocabulary Sheet'
  },
  'Part 6': {
    id: 't_part6',
    name: 'Part 6 – Email & Letter Templates',
    source: 'THE DAILY ENGLISH Vocabulary Sheet'
  },
  'Part 7': {
    id: 't_part7',
    name: 'Part 7 – Reading & Business Vocab',
    source: 'THE DAILY ENGLISH Vocabulary Sheet'
  }
};

// Derive context/specialty from part
function deriveContext(sheetName, term, meaning) {
  if (sheetName === 'Part 5') return 'Grammar & Collocation';
  if (sheetName === 'Part 6') return 'Email Writing';
  return 'Business Reading';
}

function deriveSpecialty(sheetName) {
  if (sheetName === 'Part 5') return 'TOEIC Part 5';
  if (sheetName === 'Part 6') return 'TOEIC Part 6';
  return 'TOEIC Part 7';
}

async function main() {
  const db = await open({ filename: DB_FILE, driver: sqlite3.Database });
  await db.run('PRAGMA foreign_keys = ON');

  // ─── Step 1: Remove OLD topic IDs that we're replacing ────────────────
  const OLD_TOPIC_IDS = ['t_part5', 't_part6', 't_part7', 't_toeic204'];
  console.log('🗑️  Deleting old data...');
  for (const tid of OLD_TOPIC_IDS) {
    const topic = await db.get('SELECT id FROM topics WHERE id = ?', tid);
    if (topic) {
      // learning_state + words cascade-delete on topic cascade
      await db.run('DELETE FROM words WHERE topic_id = ?', tid);
      await db.run('DELETE FROM topics WHERE id = ?', tid);
      console.log(`   Deleted topic: ${tid}`);
    }
  }

  // ─── Step 2: Read Excel ────────────────────────────────────────────────
  const wb = XLSX.readFile(EXCEL_FILE);
  const now = new Date().toISOString();

  let grandTotal = 0;

  for (const sheetName of Object.keys(SHEET_MAP)) {
    if (!wb.SheetNames.includes(sheetName)) {
      console.warn(`⚠️  Sheet "${sheetName}" not found in Excel, skipping.`);
      continue;
    }

    const config = SHEET_MAP[sheetName];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Filter valid data rows (STT must be a number)
    const dataRows = rows.slice(1).filter(r => r[0] && typeof r[0] === 'number' && r[1]);

    console.log(`\n📚 Sheet: "${sheetName}" → ${dataRows.length} words`);

    // Insert topic
    await db.run(
      `INSERT OR REPLACE INTO topics (id, name, source, word_count, added_at, archived)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [config.id, config.name, config.source, dataRows.length, now]
    );

    // Insert words
    let inserted = 0;
    for (const row of dataRows) {
      const [stt, term, pos, meaning, example] = row;
      if (!term || !meaning) continue;

      const wordId = `w_${config.id}_${String(stt).padStart(3, '0')}`;
      const cleanTerm = String(term).trim();
      const cleanMeaning = String(meaning).trim();
      const cleanExample = example ? String(example).trim() : null;
      const cleanPos = pos ? String(pos).trim() : null;

      await db.run(
        `INSERT OR REPLACE INTO words (id, topic_id, term, meaning, pos, example, context, specialty, archived)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          wordId,
          config.id,
          cleanTerm,
          cleanMeaning,
          cleanPos,
          cleanExample,
          deriveContext(sheetName, cleanTerm, cleanMeaning),
          deriveSpecialty(sheetName)
        ]
      );

      // Initialize learning_state (SRS level 0)
      await db.run(
        `INSERT OR IGNORE INTO learning_state (word_id, level, last_reviewed, next_review)
         VALUES (?, 0, NULL, NULL)`,
        [wordId]
      );

      inserted++;
    }

    console.log(`   ✅ Inserted ${inserted} words into topic "${config.id}"`);
    grandTotal += inserted;
  }

  // ─── Step 3: Verify ───────────────────────────────────────────────────
  console.log('\n📊 Final DB state:');
  const topics = await db.all('SELECT id, name, word_count FROM topics ORDER BY id');
  topics.forEach(t => console.log(`   ${t.id}: "${t.name}" (declared: ${t.word_count})`));

  const actual = await db.get('SELECT COUNT(*) as cnt FROM words WHERE archived = 0');
  console.log(`\n🎉 Total words imported: ${grandTotal}`);
  console.log(`   Actual words in DB (non-archived): ${actual.cnt}`);

  await db.close();
}

main().catch(e => {
  console.error('❌ Import failed:', e.message);
  process.exit(1);
});
