# Ôn thi OS — Giữa kỳ

Web ôn tập **Hệ điều hành** (chương 1–7), gồm: phòng thi mô phỏng, quiz nhanh, flashcard,
đọc bank theo chương, lý thuyết (slide PDF), và review câu đã gắn cờ.

> Mục tiêu: học để **hiểu**, không học vẹt. Mỗi câu có giải thích đa tầng:
> kết luận → khái niệm cốt lõi → phân tích từng đáp án sai.

---

## 1. Yêu cầu

- **Node.js** ≥ 18.18 (khuyến nghị 20 LTS) + `npm`
- **Python** ≥ 3.10 *(chỉ cần khi muốn build lại ngân hàng câu hỏi / giải thích)*
- ~200 MB ổ đĩa cho `node_modules`

> Repo **không kèm** thư mục `docs/` (PDF gốc, ~160 MB) và `kienthuc/` vì lý do bản
> quyền/dung lượng. Dữ liệu đã được trích xuất sẵn vào `web/public/data/*.json` —
> bạn clone về là chạy được luôn, không cần PDF gốc.

---

## 2. Clone & chạy (dành cho người đóng góp)

```bash
# 1. Clone
git clone <URL-repo-cua-ban>.git
cd onthi

# 2. Cài deps cho web
cd web
npm install

# 3. Chạy dev server (port 3005)
npm run dev
```

Mở trình duyệt: <http://localhost:3005>

Các script khác trong `web/`:

| Lệnh             | Mục đích                          |
| ---------------- | --------------------------------- |
| `npm run dev`    | Dev server (hot reload, port 3005)|
| `npm run build`  | Build production                  |
| `npm run start`  | Chạy bản build (port 3005)        |
| `npm run lint`   | ESLint                            |

---

## 3. Cấu trúc repo

```
onthi/
├── web/                         # Next.js 14 App Router (TypeScript + Tailwind)
│   ├── src/
│   │   ├── app/                 # 11 route: /, /exam, /quiz, /flashcard, /read, /theory, /review …
│   │   ├── components/          # AnswerActions, ExamRunner, …
│   │   └── lib/                 # store (zustand), data loader, types
│   └── public/
│       ├── data/                # ★ ngân hàng câu hỏi đã trích xuất
│       │   ├── questions.json   # 684 câu, có confidence + is_theory
│       │   ├── explanations.json# giải thích sinh tự động (xem §5)
│       │   └── stats.json
│       └── slides/              # PDF slide bài giảng (mở từ trang Lý thuyết)
├── tools/                       # script Python (chỉ chạy khi rebuild data)
│   ├── parse.py / extract_all.py / build_bank.py
│   └── gen_explanations.py      # ★ sinh giải thích từ KB nội bộ
└── README.md                    # file này
```

---

## 4. Tính năng chính

- **Phòng thi** (`/exam`): đề random theo tỉ lệ chương, có đếm giờ, chấm khi nộp, lưu lịch sử.
- **Quiz nhanh** (`/quiz`): trả lời từng câu, phản hồi tức thì + streak + giải thích.
- **Flashcard** (`/flashcard`): chỉ câu lý thuyết (`is_theory = true`), lật thẻ, đánh dấu đã thuộc.
- **Đọc bank** (`/read`): lướt toàn bộ ngân hàng theo chương, gắn cờ + xem giải thích.
- **Lý thuyết** (`/theory`): mở trực tiếp PDF slide gốc.
- **Review** (`/review`): các câu đã gắn cờ + các câu bạn đã *override* đáp án.

State (bookmark, override, lịch sử) lưu trong `localStorage` dưới key `os-onthi-v1`.

---

## 5. Giải thích câu hỏi — nó được sinh thế nào?

`tools/gen_explanations.py` build một file `explanations.json` từ 3 lớp tri thức:

1. **Glossary** (~100 thuật ngữ OS): kernel mode, syscall, PCB, semaphore, deadlock 4 đk,
   paging, TLB, FAT, RAID, CPU/I/O-bound… mỗi thuật ngữ có định nghĩa ngắn 1–2 câu.
2. **Topic library** (38 chủ đề sâu, multi-paragraph): cấu trúc kernel, IPC, các thuật toán
   lập lịch, race condition + 3 yêu cầu CS, Peterson, semaphore, monitor, producer-consumer,
   deadlock 4 đk + RAG + Banker, address binding, MMU, swapping, paging, TLB + công thức EAT,
   segmentation, fragmentation…
3. **Distractor analysis**: với mỗi đáp án sai, scan glossary để chỉ ra *thuật ngữ X mà đáp án
   sai đang nhắc tới thực ra là Y* → giúp người học hiểu **vì sao sai**, không chỉ học vẹt.

### Câu tính toán — *thành thật mà nói*

Với **63 câu numeric** (Gantt, waiting, turnaround, EAT, page-fault, đĩa, kích thước file…)
hiện tại generator **chỉ in ra công thức + phương pháp** (vd. *"waiting = start − arrival;
trung bình = tổng / n; vẽ Gantt trước"*). **Nó KHÔNG chạy mô phỏng đầy đủ từng bước**, vì
đề bài là tiếng Việt tự do, parse bảng tiến trình ra cấu trúc chuẩn còn cần làm thêm.

→ **Đây là chỗ rất cần đóng góp**: mở câu numeric trong web, viết lời giải step-by-step
   chuẩn, rồi PR theo §7 dưới. Xem mục *Override thủ công* phía dưới.

### Rebuild giải thích

```bash
python3 tools/gen_explanations.py
```

Ghi đè `web/public/data/explanations.json`. In ra số câu match topic sâu vs glossary fallback.

---

## 6. Override / sửa thủ công 1 câu

Khi bạn phát hiện 1 câu giải thích sai/hời hợt, có 2 cách:

**Cách A — sửa trực tiếp `explanations.json`** (nhanh, dùng cho 1–2 câu):

```jsonc
"q00049": {
  "why": "**Đáp án đúng: 4 GB.**\n\nBước 1: ... Bước 2: ...",
  "distractors": {
    "a": "Sai vì ...",
    "b": "..."
  },
  "topic": "Indexed allocation",
  "source": "manual"   // ← đánh dấu để generator KHÔNG ghi đè
}
```

> ⚠️ Hiện `gen_explanations.py` **ghi đè toàn bộ file**. Trước khi rebuild, hãy đảm bảo
> các entry `"source": "manual"` của bạn được merge — hoặc commit file đã sửa, đừng chạy
> generator. Nếu cần, mở issue để mình thêm cơ chế merge.

**Cách B — override đáp án trong UI**: khi làm bài, nếu nghi đáp án bank sai, click nút
*"Đặt lại đáp án đúng"* → lưu vào localStorage, hiện ở trang `/review` filter "Đã override".

---

## 7. Quy trình đóng góp (cho bạn được mời clone)

### 7.1 Khi tìm thấy chỗ cần sửa

1. Mở web (`npm run dev`), tìm câu cần review — bấm **Gắn cờ** hoặc copy ID câu (ví dụ `q00123`).
2. Tạo branch:
   ```bash
   git checkout -b fix/q00123-giai-thich-sai
   ```
3. Sửa: mở `web/public/data/explanations.json`, search ID, sửa `why` / `distractors`,
   thêm `"source": "manual"` (xem §6).
4. Test: `cd web && npm run dev` → mở câu đó, kiểm tra hiển thị OK.
5. Commit + push:
   ```bash
   git add web/public/data/explanations.json
   git commit -m "fix(q00123): viết lại giải thích sâu hơn cho race condition"
   git push origin fix/q00123-giai-thich-sai
   ```
6. Lên GitHub mở **Pull Request** vào branch `main`, mô tả:
   - Câu nào? (ID + chương)
   - Sai chỗ nào? (đính kèm screenshot nếu được)
   - Đã sửa thế nào?

### 7.2 Khi báo lỗi mà chưa sửa được

Mở **Issue** với template:

```
**Câu**: q00123  (Chương 5-6)
**Vấn đề**: phần distractor B nói về monitor nhưng câu hỏi là về semaphore
**Đề xuất**: …
```

### 7.3 Quy ước commit (gợi ý)

| Prefix      | Khi nào dùng                              |
| ----------- | ----------------------------------------- |
| `feat:`     | thêm tính năng                            |
| `fix:`      | sửa bug code / sửa giải thích sai         |
| `content:`  | bổ sung KB / glossary trong generator     |
| `docs:`     | sửa README                                |
| `chore:`    | dọn dẹp, deps, gitignore                  |

---

## 8. Push lần đầu lên GitHub (cho chủ repo)

```bash
cd /home/zukanopro/workspace/os/onthi
git init
git add .
git status                       # ← kiểm tra docs/ và .venv KHÔNG có trong list
git commit -m "chore: initial commit"
git branch -M main
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

> Trước khi commit lần đầu, mở `.gitignore` xác nhận đã bỏ `docs/`, `kienthuc/`, `.venv/`,
> `web/node_modules/`, `web/.next/`. Nếu lỡ add nhầm: `git rm -r --cached <path>` rồi commit lại.

Mời cộng tác: **Settings → Collaborators → Add people**.

---

## 9. Câu hỏi thường gặp

**Q: Bạn tôi clone về thiếu file PDF slide thì sao?**
A: PDF slide nằm ở `web/public/slides/` và **CÓ** được commit (16 MB, vẫn ổn cho GitHub).
Chỉ `docs/` (PDF nguồn lớn 160 MB) là bị `.gitignore` loại trừ.

**Q: Có cần Python không?**
A: Không, **chỉ Node.js**. Python chỉ cần nếu muốn rebuild `questions.json` /
`explanations.json` từ đầu.

**Q: Port 3005 bị chiếm?**
A: Sửa `web/package.json` script `dev`/`start` từ `-p 3005` sang port khác.

---

Chúc ôn thi tốt 🎯
