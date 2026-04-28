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

Override lưu vào localStorage của trình duyệt, áp dụng ngay cho mọi chế độ.
Để chia sẻ cho người khác: bấm **Export** → gửi file JSON → merge vào `web/public/data/questions.json` → commit.
