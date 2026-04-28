# Ôn thi OS — Giữa kỳ

Web ôn tập Hệ điều hành (chương 1–7): phòng thi mô phỏng, quiz, flashcard, đọc bank, lý thuyết.

## Yêu cầu

- **Node.js** ≥ 18.18 + `npm`

## Chạy

```bash
git clone https://github.com/ZukaNoPro2k5/onthi-os.git
cd onthi-os/web
npm install
npm run dev
```

Mở http://localhost:3005

## Sửa đáp án sai

Vào trang **Review** → chọn đáp án đúng → bấm **Lưu override**.  
Override lưu vào localStorage của browser và áp dụng ngay cho mọi mode (quiz, phòng thi, đọc bank).  
Muốn chia sẻ với người khác: bấm **Export** → gửi file JSON → merge vào `web/public/data/questions.json`.
