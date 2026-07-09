# MASTER PROMPT — Vocab Study App (Live Artifact + Google Drive MCP)

Dùng prompt này để build (hoặc build lại) toàn bộ app trong 1 lần, ở bất kỳ conversation nào có Live Artifacts.

---

## 1. Bối cảnh & mục tiêu

Xây một mini app học từ vựng, chạy dưới dạng Live Artifact (1 file HTML duy nhất), có 3 mục tiêu cốt lõi:

1. Người học ghi nhớ từ vựng nhanh qua nhiều chế độ: flashcard, quiz, game.
2. Tiến trình học được lưu lại **hàng ngày, cộng dồn** — mở lại app thì tiến trình lần trước vẫn còn nguyên.
3. Từ vựng được lấy từ các file trong 1 folder Google Drive. Mỗi khi có file mới, app tự quét và bổ sung bài học mới **mà không đụng đến tiến trình đã học**.

## 2. Cơ chế hoạt động

- Người dùng để các file từ vựng (định dạng tự do: docx/txt viết đoạn "từ - nghĩa - ví dụ", HOẶC Excel/CSV có cột rõ ràng — app phải **tự nhận diện cả hai kiểu**) trong 1 folder Google Drive.
- App gọi Anthropic API (bên trong artifact, kèm `mcp_servers` trỏ Google Drive) để:
  a. Liệt kê file trong folder.
  b. Với file mới/đã sửa: đọc nội dung, trích xuất từ vựng thành JSON có cấu trúc.
- Việc quét Drive **chỉ chạy khi người dùng bấm nút Sync** (không tự động mỗi lần mở app, để tránh gọi API thừa).
- File mới → thêm chủ đề mới. File cũ không đổi → bỏ qua, không gọi lại API.

## 3. Kiến trúc kỹ thuật

- 1 file HTML duy nhất (không dùng React), render như Live Artifact.
- Lưu trạng thái bằng `window.storage` (key-value có sẵn của artifact), **không dùng localStorage/sessionStorage**.
- Gọi Anthropic API trực tiếp từ artifact (`fetch` tới `https://api.anthropic.com/v1/messages`) kèm `mcp_servers` cho bước cần đọc Google Drive.
- Không có backend, không có server riêng — mọi logic chạy client-side trong artifact.

## 4. Storage schema (bắt buộc theo đúng key sau)

```
drive-config      → { folderLink }
known-files       → { "<filename>": { modifiedTime, topicId } }
topics            → [{ id, name, source, wordCount, addedAt, archived }]
topic-data:<id>   → { words: [{ id, term, meaning, example }] }
learning-state    → { progress: { "<wordId>": { level, lastReviewed, nextReview } }, dailyLog: { "<date>": count }, streak }
```

Không tự ý đặt key khác ngoài danh sách trên. Key mới (nếu cần) phải theo pattern `noun` hoặc `noun:id`, chữ thường, gạch ngang.

## 5. Sync policy (luồng bắt buộc, đúng thứ tự)

1. Đọc `known-files` từ storage.
2. Gọi API (kèm Drive MCP), prompt yêu cầu liệt kê file trong folder, `max_tokens` ≈ 1024, trả JSON thuần (không markdown fence).
3. Diff với `known-files`: chỉ giữ lại file mới hoặc có `modifiedTime` khác.
4. Với từng file cần xử lý: gọi API (kèm Drive MCP) đọc nội dung và trích xuất từ vựng, `max_tokens` ≈ 4096, trả JSON `{ topicName, words: [{term, meaning, example}] }`.
5. Merge kết quả vào `topics` và `topic-data:<id>`; cập nhật `known-files`.
6. Từ bị xoá khỏi file gốc → đánh dấu `archived: true` trong `topic-data`, không xoá progress liên quan trong `learning-state`.
7. **Tuyệt đối không ghi vào `learning-state` trong toàn bộ luồng sync này.**

## 6. Chế độ học

Cả 3 chế độ dùng chung 1 hàm `applyReview(wordId, correct)`:
- `correct` → `level = min(4, level+1)`; `sai` → `level = max(0, level-1)`.
- `nextReview` tính theo bảng ngày: level 0→hôm nay, 1→+1 ngày, 2→+3 ngày, 3→+7 ngày, 4→+14 ngày.
- Mỗi lần review: cộng `dailyLog[hôm nay]`, tính lại `streak` (số ngày liên tiếp có học).

**Flashcard**: lật thẻ, tự chấm "nhớ / chưa nhớ".
**Quiz**: trắc nghiệm nghĩa, đáp án nhiễu lấy ngẫu nhiên từ pool từ vựng toàn app.
**Game**: ghép cặp term–meaning theo thời gian, mỗi cặp ghép đúng = 1 review đúng.

Từ "đến hạn" = chưa có progress (mới) hoặc `nextReview <= hôm nay`. Mỗi phiên học giới hạn tối đa ~20 từ, ưu tiên từ đến hạn trước.

## 7. Quy tắc dự án (bắt buộc tuân thủ khi code)

1. **Write-guard**: không bao giờ ghi đè toàn bộ `learning-state` — luôn đọc → merge → ghi lại.
2. **Naming convention**: đúng schema ở mục 4.
3. **Token discipline**: chỉ gọi API khi bấm Sync; không gọi lại cho file không đổi; tách `max_tokens` theo tác vụ (list thấp, parse cao).
4. **Sync policy**: đúng 7 bước ở mục 5, không đảo thứ tự, không bỏ bước.
5. **UI/UX consistency**: 1 bộ design token duy nhất cho toàn app, không đổi giữa các view.

## 8. Design tokens (visual identity)

Chủ đề: "sổ tay từ vựng ban đêm" — thẻ từ như thẻ mục lục thư viện thật, nền tối kiểu bàn học đêm. Tránh mọi tổ hợp mặc định kiểu AI (nền cream + serif tương phản cao + accent cam đất; nền đen + 1 accent xanh chuối/đỏ chói; layout hairline kiểu báo).

- Nền: `#14181F` (ink navy), bề mặt card: `#1E2430` / `#252C3A`.
- Thẻ flashcard: giấy kem `#F6F1E4`, chữ `#23201A`, có lỗ bấm góc trái trên, gạch chân dưới từ, góc thẻ (dog-ear) đổi màu theo SRS level.
- Accent: gold `#E8B84B` (tiến trình/streak), teal `#4FBDBA` (đúng/thành công), coral `#E8623D` (dùng dè xẻn, chỉ icon streak/lửa).
- Font: display serif (Fraunces) cho từ vựng/tiêu đề, sans (IBM Plex Sans) cho UI, mono (IBM Plex Mono) cho số liệu/thống kê.
- Signature element: flashcard dạng thẻ mục lục thật, không dùng numbered marker (01/02/03) trừ khi thật sự là chuỗi có thứ tự.

## 9. Yêu cầu build

- 1 file HTML, có `<style>` và `<script>` trong cùng file, nền trong suốt ở phần ngoài cùng, không padding cấp cao nhất thừa.
- Có: Dashboard (danh sách chủ đề, streak, số từ đã thuộc), nút Sync + ô nhập link folder Drive, 3 view học (Flashcard/Quiz/Game), xử lý lỗi khi gọi API thất bại (thông báo rõ ràng, không đổ lỗi người dùng).
- Responsive tới mobile, focus state rõ khi dùng bàn phím, tôn trọng `prefers-reduced-motion`.
