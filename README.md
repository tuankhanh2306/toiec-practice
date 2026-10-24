# 📚 TÀI LIỆU DỰ ÁN: TOEIC PRACTICE (VOCABULARY & READING APP)

---

## 1. TỔNG QUAN DỰ ÁN
**TOEIC Practice App** là ứng dụng web full-stack hỗ trợ người học ôn luyện từ vựng và bài đọc TOEIC (Part 5, 6, 7) với phương pháp lặp lại ngắt quãng (Spaced Repetition System - SRS), thuật toán Quiz thông minh hỗ trợ ghi nhớ sâu, và các mô-đun giải thích bài đọc chuyên nghiệp.

* **Công nghệ cốt lõi:**
  * **Backend:** Node.js, Express.js.
  * **Database:** SQLite (`database.sqlite`) sử dụng thư viện `sqlite3` và `sqlite`.
  * **Frontend:** Vanilla HTML5, CSS3, JavaScript (SPA - Single Page Application không cần framework cồng kềnh, tối ưu hiệu năng).
  * **PWA & Offline:** Tích hợp `sw.js` (Service Worker) và `manifest.json`.
  * **AI & Document Processing:** Gemini API, Mammoth (docx), pdf-parse (pdf), xlsx (Excel).
* **Kho lưu trữ mã nguồn:** [https://github.com/tuankhanh2306/toiec-practice.git](https://github.com/tuankhanh2306/toiec-practice.git)

---

## 2. KIẾN TRÚC THƯ MỤC DỰ ÁN

```text
e:/practice-toeic/
├── server.js                      # Server Express, API RESTful & xử lý SQLite
├── import_from_xlsx.js            # Script đồng bộ toàn bộ từ vựng từ file Excel vào Database
├── seed_reading_from_excel.js     # Script tạo đề luyện Reading Part 5, 6, 7 dựa trên từ vựng Excel
├── database.sqlite                # Cơ sở dữ liệu SQLite lưu trữ toàn bộ dữ liệu
├── package.json                   # Cấu hình dependency dự án
├── public/
│   ├── index.html                 # Giao diện chính (SPA chứa tất cả các màn hình View)
│   ├── app.js                     # Toàn bộ logic frontend (API client, Router, SRS, Quiz, Reading, Games)
│   ├── styles.css                 # Hệ thống Design Tokens & CSS Styling (Dark Theme & Thẻ chỉ mục)
│   ├── sw.js                      # Service Worker hỗ trợ offline/cache
│   └── manifest.json              # Web App Manifest (PWA)
└── Tài liệu tham khảo/
    ├── Bản sao của THE DAILY ENGLISH_Vocabulary_Sheet.xlsx  # File nguồn từ vựng Part 5, 6, 7
    ├── 600 Từ vựng TOEIC_ Tổng hợp [PDF]...pdf
    └── [Vocab] Từ vựng LISTENING dành cho aim 750+.pdf
```

---

## 3. CƠ SỞ DỮ LIỆU (DATABASE SCHEMA)

Cơ sở dữ liệu SQLite gồm 7 bảng cốt lõi:

* **topics**: Chứa danh mục bài học / chuyên đề (`id`, `name`, `source`, `word_count`, `added_at`, `archived`).
* **words**: Chứa thông tin từ vựng đầy đủ (`id`, `topic_id`, `term`, `meaning`, `pos`, `ipa`, `example`, `context`, `specialty`, `synonyms`, `collocations`, `word_family`, `starred`, `archived`).
* **learning_state**: Trạng thái học theo thuật toán SRS (`word_id`, `level`, `last_reviewed`, `next_review`).
* **reading_passages**: Đoạn văn đề thi TOEIC Part 6 và Part 7 (`id`, `part`, `title`, `passage_text`, `created_at`).
* **reading_questions**: Bộ câu hỏi kèm đáp án và phân tích ngữ pháp chuyên sâu cho Part 5, 6, 7 (`id`, `passage_id`, `part`, `question_number`, `question_text`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_option`, `question_type`, `translation`, `analysis`, `vocab_highlights`).
* **daily_log**: Ghi nhận số lượng từ đã ôn tập mỗi ngày để duy trì chuỗi Streak (`date`, `count`).
* **settings**: Cấu hình hệ thống và API Key (`key`, `value`).

---

## 4. CÁC TÍNH NĂNG VÀ THUẬT TOÁN ĐẶC BIỆT

### 4.1. Thuật toán Lặp lại Ngắt quãng (SRS 4 cấp độ)
Mỗi từ vựng được xếp vào một trong các cấp độ nhớ từ 0 đến 4:
* **Cấp độ 0 (Mới):** Cần học ngay trong ngày.
* **Cấp độ 1:** Ôn lại sau **+1 ngày**.
* **Cấp độ 2:** Ôn lại sau **+3 ngày**.
* **Cấp độ 3:** Ôn lại sau **+7 ngày**.
* **Cấp độ 4 (Đã thuộc):** Ôn lại sau **+14 ngày**.
* **Cơ chế chấm điểm Flashcard:**
  * `Quên (Again / 1)`: Trả về Cấp độ 0.
  * `Khó (Hard / 2)`: Giữ nguyên hoặc giảm 1 cấp độ.
  * `Nhớ (Good / 3)`: Tăng lên 1 cấp độ.
  * `Dễ (Easy / 4)`: Tăng tối đa hoặc nhảy cóc cấp độ (+2).

### 4.2. Thuật toán Quiz Thông Minh Giúp Nhớ Lâu
Khác với quiz ngẫu nhiên thông thường, thuật toán Quiz của ứng dụng áp dụng:
1. **Đáp án nhiễu thông minh (Smart Distractors):** Ưu tiên chọn từ gây nhiễu **cùng từ loại (POS)** và **cùng chủ đề/ngữ cảnh** để buộc não bộ phải phân biệt sắc thái nghĩa thực tế, tránh đoán mò.
2. **Chế độ Ngữ cảnh (Context Mode):** Tự động che từ vựng trong câu ví dụ (`_______`), yêu cầu người học dựa vào văn cảnh để chọn đáp án.
3. **Leitner Re-Queue (Hàng đợi lặp lại trong phiên):** Những từ trả lời sai lập tức được đẩy về **cuối phiên học** để người học gặp lại và củng cố ngay trước khi kết thúc bài học.
4. **Bảng giải thích trực quan (Explanation Panel):** Hiển thị ngay câu ví dụ, từ loại, phân tích ngữ pháp sau mỗi câu trả lời.
5. **Đo lường độ chính xác thời gian thực (Real-time Accuracy):** Tự động đổi màu huy hiệu tỉ lệ đúng (Xanh / Vàng / Đỏ).

### 4.3. Mô-đun Luyện Đọc TOEIC (Part 5, 6, 7)
* **Part 5:** Luyện câu đơn, ngữ pháp, collocations và từ loại.
* **Part 6:** Luyện điền đoạn văn (Email công việc, thông báo nội bộ, công văn).
* **Part 7:** Luyện đọc hiểu văn bản thương mại, hợp đồng, lịch trình bảo trì.
* **Tính năng Rút từ vựng vào SRS:** Mỗi câu hỏi đều phân tích chi tiết các từ khó; người học có thể nhấn **"+ Thêm vào SRS"** để đưa từ trong bài đọc vào danh sách ôn tập cá nhân.

### 4.4. Các Chế Độ Học Khác
* **Matching Game:** Luyện phản xạ ghép cặp Từ vựng ↔ Ý nghĩa trong 60 giây.
* **Speed Test:** Thử thách trả lời nhanh 20 câu trong vòng 60 giây.
* **Từ điển tra cứu & Đánh dấu từ hay quên (⭐):** Lọc theo bảng chữ cái A-Z, cấp độ SRS, và chỉnh sửa chi tiết các trường ngôn ngữ học (IPA, Synonyms, Collocations).

---

## 5. HƯỚNG DẪN KHỞI CHẠY VÀ VẬN HÀNH

### Cài đặt và Khởi động
```bash
# Di chuyển vào thư mục dự án
cd e:\practice-toeic

# Cài đặt các gói phụ thuộc (nếu chưa cài)
npm install

# Khởi động máy chủ backend
node server.js
```
Truy cập ứng dụng tại trình duyệt: [http://localhost:3000](http://localhost:3000)

### Đồng bộ / Tái lập dữ liệu từ Excel
Nếu bạn muốn nạp lại danh sách từ vựng gốc và các bài đọc từ file Excel:
```bash
# Nạp 633 từ vựng Part 5, 6, 7
node import_from_xlsx.js

# Nạp bộ câu hỏi luyện đọc Part 5, 6, 7 tương ứng
node seed_reading_from_excel.js
```
