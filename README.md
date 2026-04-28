# Ôn thi OS — Giữa kỳ

Web ôn tập Hệ điều hành (chương 1–7): phòng thi mô phỏng, quiz, flashcard, đọc bank, lý thuyết.

---

## Cài đặt & chạy

**Yêu cầu:** Node.js ≥ 18 ([tải tại đây](https://nodejs.org))

```bash
git clone https://github.com/ZukaNoPro2k5/onthi-os.git
cd onthi-os
bash start.sh
```

> Hoặc làm thủ công:
> ```bash
> cd web
> npm install
> npm run dev
> ```

Mở trình duyệt: http://localhost:3005

---

## Sửa đáp án sai

Vào trang **Review** → chọn đáp án đúng → **Lưu override**.
Override lưu trong localStorage và áp dụng ngay cho mọi chế độ (Quiz, Phòng thi, Đọc bank, Flashcard).

### Quy trình chuẩn hoá (đưa override vào bank)

Khi bạn đã review kỹ và chắc chắn đáp án đúng:

1. **Lưu nháp** — ghi overrides hiện tại ra `web/public/data/overrides.json` (dev only).
2. **Chuẩn hoá** — patch trực tiếp vào `web/public/data/questions.json`, set `confidence=1`, ghi log vào `edit_history.json`, reset overrides.
3. **Lịch sử** — bấm nút *Lịch sử* để xem mọi thay đổi (`time · id · before → after`).
4. `git commit` các file JSON đã sửa để chia sẻ.

> Cả hai API (`/api/save-overrides`, `/api/canonicalize`) chỉ hoạt động ở `NODE_ENV=development`.

## Lý thuyết

Vào **Lý thuyết** để xem:
- **Tóm tắt theo chương** (Markdown, có công thức + bảng + lưu ý ôn tập) — nguồn `web/public/summaries/*.md`.
- **Slide gốc** PDF của giảng viên — viewer ngay trong trang.
