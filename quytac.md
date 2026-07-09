# Quy tắc dự án — Vocab Study App (Live Artifact)

Bản rút gọn từ tinh thần AI-Agent-Master, chỉnh cho quy mô 1-file artifact (không có backend/VPS nên phần lớn skill gốc không áp dụng).

## 1. Write-Guard — bảo vệ tiến trình học
- **Không bao giờ** ghi đè toàn bộ key `learning-state`. Luôn đọc → merge → ghi lại.
- Khi sync file từ vựng mới: chỉ được thêm/cập nhật `topics` và `topic-data:<id>`. Cấm mọi thao tác động vào `learning-state` trong luồng sync.
- Từ vựng bị xoá khỏi file Drive gốc → đánh dấu `archived: true`, **không xoá** progress của từ đó.

## 2. Naming Convention — storage keys
```
drive-config      → { folderLink }
known-files       → { "<filename>": { modifiedTime, topicId } }
topics            → [{ id, name, source, wordCount, addedAt, archived }]
topic-data:<id>   → { words: [{ id, term, meaning, example }] }
learning-state    → { progress: {...}, dailyLog: {...}, streak }
```
Mọi key mới thêm sau này phải theo pattern `noun` hoặc `noun:id`, viết thường, nối bằng gạch ngang.

## 3. Token Discipline — kỷ luật gọi API
- Chỉ gọi Anthropic API (list Drive / parse file) khi người dùng bấm nút **Sync** — không tự động gọi mỗi lần mở app.
- Bước "liệt kê file" dùng `max_tokens` thấp (≈1024). Bước "trích xuất từ vựng" mới cần cao hơn (≈4096) vì phải trả JSON dài.
- Không gọi lại API cho file đã có trong `known-files` với `modifiedTime` không đổi.

## 4. Sync Policy — quy trình đồng bộ Drive
1. Đọc `known-files` từ storage.
2. Gọi API (kèm Drive MCP) liệt kê file trong folder.
3. Diff: file mới hoặc `modifiedTime` thay đổi → xử lý; còn lại bỏ qua.
4. Với file cần xử lý: gọi API trích xuất từ vựng → JSON `{ topicName, words }`.
5. Merge vào `topics` / `topic-data:<id>`, cập nhật `known-files`.
6. Không có bước nào trong luồng này được phép ghi vào `learning-state`.

## 5. UI/UX Consistency — design tokens cố định
Một khi bộ token màu/typography (index-card, nền tối, accent gold/teal/coral) đã chốt, không đổi giữa các view. Mọi thành phần mới phải tái dùng token có sẵn, không tự chế màu/font mới.
