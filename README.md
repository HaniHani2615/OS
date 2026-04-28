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

Vào trang **Review** → chọn đáp án đúng → **Xác nhận & tiếp theo**.

Mỗi lần xác nhận, câu được patch thẳng vào `web/public/data/questions.json` (set `confidence=1`, `decision=manual_verified`) và rời queue *Cần review* ngay lập tức — không cần reload, không cần bước thứ hai.

### Tab "Đã sửa"

- Liệt kê toàn bộ câu đã xác nhận (`time · id · before → after`).
- **Click vào một dòng** (hoặc nút *Sửa lại*) để mở chính câu đó trong tab *Tất cả* — giá trị hiện tại được nạp sẵn để bạn chỉnh tiếp.
- Nút **Hoàn tác** revert câu về đáp án trước, đẩy lại vào queue *Cần review*.
- Lưu sử ghi tại `web/public/data/edit_history.json`.

> Các API (`/api/confirm-answer`, `/api/undo-answer`) chỉ hoạt động ở `NODE_ENV=development`. Sau khi sửa xong, `git commit` các file JSON để chia sẻ.

## Lý thuyết

Vào **Lý thuyết** để xem:
- **Tóm tắt theo chương** (Markdown, có công thức + bảng + lưu ý ôn tập) — nguồn `web/public/summaries/*.md`.
- **Slide gốc** PDF của giảng viên — viewer ngay trong trang.
