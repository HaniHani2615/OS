"""Rich AI-style explanations for the OS midterm question bank.

Strategy:
  1. **Topic library**  – ~70 deep multi-paragraph explanations keyed by keywords.
                          Picks the highest-scoring topic for each question.
  2. **Glossary**       – ~120 short definitions of OS terms.  For every
                          distractor, scan its text for glossary hits and emit
                          "thuật ngữ X thực ra là …" explanations so the
                          learner understands *why* that wrong choice is wrong
                          (and doesn't just memorise letters).
  3. **Pattern hooks**  – numeric answers (waiting time, turnaround, EAT,
                          page calc) get a formula-based explanation.

Output: web/public/data/explanations.json keyed by question id, with
  - why            (rich markdown explanation of the correct answer)
  - distractors    (label → explanation of what that wrong answer actually
                    refers to in OS, and why it doesn't fit the question)
  - topic, source

Run:  python3 tools/gen_explanations.py
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_PATH = ROOT / "web" / "public" / "data" / "questions.json"
OUT_PATH = ROOT / "web" / "public" / "data" / "explanations.json"


def fold(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("đ", "d").replace("Đ", "D")
    return s.lower()


# ------------------------------------------------------------------ #
# 1. GLOSSARY — Vietnamese OS terms → concise definition
# ------------------------------------------------------------------ #

GLOSSARY: list[tuple[str, list[str], str]] = [
    ("hệ điều hành", ["he dieu hanh", "operating system"],
     "phần mềm nằm giữa người dùng và phần cứng — quản lý tài nguyên và cung cấp dịch vụ cho ứng dụng"),
    ("kernel monolithic", ["monolithic", "nhan don the", "monolithic kernel"],
     "kiến trúc kernel mà mọi dịch vụ HĐH (FS, scheduler, driver, IPC) chạy chung trong một không gian địa chỉ — nhanh nhưng khó bảo trì (Linux truyền thống)"),
    ("microkernel", ["microkernel", "vi nhan"],
     "kernel chỉ giữ tối thiểu (IPC, lập lịch cơ bản, quản lý bộ nhớ thấp); mọi dịch vụ khác chạy ở user-mode — bảo mật/portable nhưng IPC tốn chi phí"),
    ("layered structure", ["phan lop", "layered"],
     "cấu trúc phân lớp: lớp i chỉ gọi lớp i-1, dễ debug nhưng khó định nghĩa thứ tự lớp và tốn chi phí cross-layer"),
    ("module", ["loadable kernel module", "loadable module"],
     "phần mở rộng kernel có thể nạp/gỡ runtime — cách Linux/Solaris cân bằng monolithic và microkernel"),
    ("dual mode", ["dual mode", "user mode", "kernel mode", "che do nhan", "che do nguoi dung", "che do kep"],
     "CPU có 2 mức quyền: kernel mode được phép thực thi mọi lệnh, user mode bị chặn lệnh đặc quyền"),
    ("system call", ["system call", "loi goi he thong", "syscall"],
     "lời gọi từ user → kernel để yêu cầu dịch vụ (open, read, fork, exec…) — chuyển CPU sang kernel mode qua trap"),
    ("interrupt", ["interrupt", "ngat"],
     "tín hiệu bất đồng bộ từ phần cứng yêu cầu CPU dừng việc đang làm để xử lý sự kiện (I/O xong, timer hết hạn…)"),
    ("trap / exception", ["trap", "exception", "ngoai le"],
     "ngắt phần mềm đồng bộ do lệnh chương trình sinh ra — chia 0, page fault, system call đều là trap"),
    ("interrupt vector", ["interrupt vector", "vector ngat"],
     "bảng chứa địa chỉ ISR cho từng loại ngắt — CPU dùng số ngắt làm chỉ mục để rẽ nhánh"),
    ("DMA", ["dma", "direct memory access"],
     "thiết bị có thể đọc/ghi RAM trực tiếp không qua CPU — giảm tải khi truyền dữ liệu lớn"),
    ("virtual machine", ["virtual machine", "may ao", "vmm", "hypervisor"],
     "phần mềm tạo ảo giác mỗi tiến trình/OS có máy tính riêng; type-1 chạy trên bare metal, type-2 chạy trên OS chủ"),
    ("đa chương trình", ["da chuong trinh", "multiprogramming"],
     "nhiều chương trình cùng nằm trong RAM — khi một chương trình I/O thì CPU chuyển sang chương trình khác"),
    ("đa nhiệm / time-sharing", ["da nhiem", "time sharing", "time-sharing", "chia thoi gian"],
     "mở rộng đa chương trình bằng cách chia CPU theo lát thời gian, cho cảm giác mọi người dùng có máy riêng"),
    ("real-time", ["real time", "real-time", "thoi gian thuc"],
     "hệ thống có ràng buộc deadline cứng/mềm — kết quả đúng nhưng trễ hạn cũng bị coi là sai"),
    ("embedded", ["embedded", "nhung"],
     "hệ thống được nhúng vào thiết bị chuyên dụng (router, máy giặt, ô tô); thường tài nguyên hạn chế"),
    ("distributed", ["distributed", "phan tan"],
     "hệ thống nhiều máy hợp tác qua mạng, người dùng thấy như một máy thống nhất"),
    ("CPU-bound", ["cpu bound", "cpu-bound", "thien ve cpu"],
     "tiến trình dành phần lớn thời gian thực thi tính toán trên CPU, ít I/O — ví dụ: nhân ma trận, mã hoá, render"),
    ("I/O-bound", ["i/o bound", "i/o-bound", "io-bound", "io bound", "thien ve i/o"],
     "tiến trình dành phần lớn thời gian chờ I/O, ít dùng CPU — ví dụ: server, ứng dụng tương tác"),
    ("FAT", [" fat ", "file allocation table"],
     "File Allocation Table — bảng cấp phát kiểu danh sách liên kết: mỗi entry chứa số block kế tiếp; gốc của FAT12/16/32"),
    ("linked allocation", ["linked allocation", "cap phat lien ket", "danh sach lien ket"],
     "mỗi file là chuỗi block liên kết; không external fragmentation nhưng truy cập ngẫu nhiên chậm — FAT là biến thể"),
    ("indexed allocation", ["indexed allocation", "cap phat chi muc", "index block"],
     "mỗi file có 1 index block chứa danh sách các block dữ liệu; truy cập ngẫu nhiên nhanh"),
    ("directory", ["thu muc", "directory"],
     "cấu trúc tổ chức tập tin: linear list (tìm chậm), hash table (nhanh), tree (UNIX)"),
    ("RAID", [" raid ", "redundant array"],
     "gộp nhiều đĩa: RAID 0 stripe (tốc độ), RAID 1 mirror (an toàn), RAID 5/6 stripe+parity (cân bằng)"),

    ("tiến trình", ["tien trinh", "process"],
     "chương trình đang thực thi — gồm code, data, stack, heap, PCB; là đơn vị phân bổ tài nguyên"),
    ("PCB", ["pcb", "process control block", "khoi dieu khien tien trinh"],
     "cấu trúc dữ liệu lưu mọi thông tin về tiến trình: ID, trạng thái, PC, các thanh ghi, thông tin lập lịch — dùng để context switch"),
    ("thread", ["thread", "tieu trinh", "luong"],
     "đơn vị thực thi nhẹ trong tiến trình — chia sẻ code/data/heap với các thread cùng tiến trình nhưng có stack + PC + thanh ghi riêng"),
    ("context switch", ["context switch", "chuyen ngu canh"],
     "lưu trạng thái tiến trình hiện tại vào PCB và nạp PCB tiến trình mới — overhead thuần, không làm việc hữu ích"),
    ("ready queue", ["ready queue", "hang doi san sang"],
     "danh sách các tiến trình ở trạng thái ready chờ CPU"),
    ("waiting queue", ["waiting queue", "hang doi cho", "device queue"],
     "tiến trình đang đợi sự kiện/I/O hoàn tất — nằm trong waiting queue gắn với thiết bị tương ứng"),
    ("fork", ["fork()", " fork "],
     "system call tạo tiến trình con bằng cách sao chép không gian địa chỉ tiến trình cha; cha nhận pid con, con nhận 0"),
    ("exec", ["exec()", " exec "],
     "thay thế hoàn toàn không gian địa chỉ tiến trình hiện tại bằng chương trình mới — không tạo tiến trình mới"),
    ("zombie", ["zombie"],
     "tiến trình đã exit nhưng cha chưa wait — vẫn còn entry trong process table"),
    ("orphan", ["orphan", "mo coi"],
     "tiến trình con mà cha đã chết trước — được init nhận làm con nuôi"),
    ("init", ["init", "tien trinh init"],
     "tiến trình đầu tiên (pid 1) — tổ tiên của mọi tiến trình, nhận con mồ côi"),
    ("tiến trình hợp tác", ["tien trinh hop tac", "cooperating"],
     "tiến trình có thể ảnh hưởng/bị ảnh hưởng bởi tiến trình khác qua dữ liệu chia sẻ; ngược lại là tiến trình độc lập"),
    ("IPC", ["ipc", "inter process", "lien lac giua tien trinh", "truyen thong giua tien trinh"],
     "cơ chế trao đổi dữ liệu giữa tiến trình — hai mô hình: shared memory và message passing"),
    ("shared memory", ["shared memory", "bo nho chia se"],
     "nhiều tiến trình cùng map một vùng bộ nhớ vật lý — nhanh nhưng tự đồng bộ"),
    ("message passing", ["message passing", "truyen thong diep"],
     "tiến trình gửi/nhận message qua kernel — chậm hơn shared memory nhưng dễ mở rộng cho hệ phân tán"),
    ("pipe", ["pipe", "duong ong"],
     "kênh IPC một chiều, nửa song công — anonymous pipe chỉ cha-con, named pipe (FIFO) bất kỳ tiến trình"),
    ("socket", ["socket"],
     "endpoint giao tiếp qua mạng (hoặc UNIX domain) — TCP cho luồng tin cậy, UDP cho datagram"),

    ("FCFS", ["fcfs", "first come first", "den truoc phuc vu truoc"],
     "lập lịch không tiếm quyền theo thứ tự đến — đơn giản nhưng dễ gây convoy effect"),
    ("SJF", ["sjf", "shortest job first", "ngan nhat truoc"],
     "chọn tiến trình có CPU burst kế tiếp ngắn nhất — tối ưu thời gian chờ trung bình nhưng cần dự đoán burst"),
    ("SRTF", ["srtf", "shortest remaining"],
     "phiên bản tiếm quyền của SJF — khi tiến trình mới đến có burst còn lại ngắn hơn tiến trình đang chạy thì cướp CPU"),
    ("Round Robin", ["round robin", " rr ", "quay vong"],
     "FCFS tiếm quyền theo time quantum q — q nhỏ → quá nhiều context switch, q lớn → suy biến thành FCFS"),
    ("priority scheduling", ["priority scheduling", "lap lich uu tien"],
     "chọn tiến trình có độ ưu tiên cao nhất — tiếm quyền hoặc không; rủi ro starvation"),
    ("multilevel queue", ["multilevel queue", "hang doi nhieu muc"],
     "chia ready queue thành nhiều hàng theo loại tiến trình; tiến trình không di chuyển giữa các hàng"),
    ("multilevel feedback", ["multilevel feedback", "hoi tiep da muc"],
     "tiến trình có thể di chuyển giữa các hàng dựa trên hành vi — gần như mọi HĐH hiện đại dùng"),
    ("aging", ["aging", "lao hoa"],
     "tăng độ ưu tiên của tiến trình theo thời gian chờ — chống starvation cho priority scheduling"),
    ("starvation", ["starvation", "nan doi"],
     "tiến trình bị từ chối tài nguyên/CPU vô thời hạn vì luôn có tiến trình khác ưu tiên hơn"),
    ("convoy effect", ["convoy effect"],
     "trong FCFS, một tiến trình CPU-bound dài chặn các tiến trình I/O-bound ngắn → throughput thấp"),
    ("dispatcher", ["dispatcher", "bo dieu phoi"],
     "module thực hiện việc chuyển CPU sang tiến trình do scheduler chọn (context switch + chuyển user mode + nhảy đến PC)"),
    ("dispatch latency", ["dispatch latency", "do tre dieu phoi"],
     "thời gian dispatcher dừng tiến trình cũ đến lúc khởi động được tiến trình mới"),
    ("CPU burst", ["cpu burst", "cum cpu", "chu ki cpu"],
     "khoảng thời gian tiến trình thực thi liên tục trên CPU giữa hai lần I/O"),
    ("I/O burst", ["i/o burst", "io burst", "cum i/o"],
     "khoảng thời gian tiến trình đang đợi I/O hoàn tất — xen kẽ với CPU burst"),
    ("long-term scheduler", ["long term", "long-term", "dai han"],
     "chọn tiến trình từ pool đưa vào ready queue — kiểm soát mức đa chương; gọi không thường xuyên"),
    ("short-term scheduler", ["short term", "short-term", "ngan han"],
     "chọn tiến trình trong ready queue để cấp CPU — gọi rất thường xuyên"),
    ("medium-term scheduler", ["medium term", "medium-term", "trung han"],
     "tạm đẩy tiến trình ra disk (swap-out) khi RAM thiếu, đưa vào lại khi đủ"),
    ("turnaround time", ["turnaround", "thoi gian quay vong", "thoi gian hoan thanh"],
     "thời gian từ lúc tiến trình submit đến lúc kết thúc"),
    ("waiting time", ["waiting time", "thoi gian cho"],
     "tổng thời gian tiến trình nằm trong ready queue — không tính thời gian I/O hay thời gian thực thi CPU"),
    ("response time", ["response time", "thoi gian phan hoi"],
     "thời gian từ submit đến lúc tiến trình bắt đầu phản hồi đầu tiên"),
    ("throughput", ["throughput", "thong luong"],
     "số tiến trình hoàn thành trên đơn vị thời gian"),

    ("race condition", ["race condition", "tranh chap"],
     "kết quả phụ thuộc thứ tự thực thi không xác định khi nhiều thread cùng truy cập dữ liệu chia sẻ và ≥1 ghi"),
    ("critical section", ["critical section", "vung gang", "mien gang", "doan gang", "vung tranh chap"],
     "đoạn mã thao tác dữ liệu chia sẻ; tại mỗi thời điểm chỉ một tiến trình được phép vào"),
    ("mutual exclusion", ["mutual exclusion", "loai tru lan nhau"],
     "chỉ một tiến trình ở trong critical section tại mỗi thời điểm"),
    ("progress", ["progress", "tien trien"],
     "yêu cầu CS: nếu CS rỗng và có tiến trình muốn vào, không thể trì hoãn vô hạn việc chọn"),
    ("bounded waiting", ["bounded waiting", "cho gioi han", "cho co han"],
     "yêu cầu CS: phải có giới hạn số lần các tiến trình khác được vào CS trước khi tiến trình này được vào"),
    ("Peterson", ["peterson"],
     "thuật toán phần mềm cho 2 tiến trình giải critical section dùng flag[i] và turn"),
    ("test-and-set", ["test and set", "test-and-set"],
     "lệnh nguyên tử phần cứng: đọc giá trị cũ và set thành 1 trong một lần — dùng xây dựng spinlock"),
    ("compare-and-swap", ["compare and swap", "compare-and-swap"],
     "lệnh nguyên tử so sánh và thay đổi — nền tảng cho lock-free programming"),
    ("semaphore", ["semaphore", " den bao "],
     "biến số nguyên với hai thao tác nguyên tử wait(P) và signal(V); binary = mutex, counting quản lý N tài nguyên"),
    ("mutex", ["mutex", "khoa loai tru"],
     "khóa nhị phân acquire/release — dạng đơn giản của semaphore"),
    ("monitor", ["monitor"],
     "construct ngôn ngữ đóng gói biến chia sẻ + thủ tục thao tác, đảm bảo mutex tự động"),
    ("condition variable", ["condition variable", "bien dieu kien"],
     "biến trong monitor có wait() (giải phóng monitor + chờ) và signal() (đánh thức một thread)"),
    ("busy waiting", ["busy waiting", "cho ban"],
     "thread vòng lặp kiểm tra điều kiện thay vì block — lãng phí CPU trên uniprocessor"),
    ("producer consumer", ["producer", "consumer", "san xuat", "tieu thu", "bounded buffer"],
     "bài toán kinh điển: producer ghi vào buffer kích thước N, consumer đọc; dùng 3 semaphore mutex/empty/full"),
    ("readers writers", ["readers writers", "doc ghi", "doc viet"],
     "nhiều reader đọc đồng thời, writer độc quyền"),
    ("dining philosophers", ["dining philosophers", "triet gia"],
     "bài toán 5 triết gia 5 đũa minh họa deadlock"),
    ("atomic", ["atomic", "nguyen to", "khong the chia"],
     "thao tác không thể bị ngắt giữa chừng — hoặc thực hiện toàn bộ hoặc không gì cả"),

    ("deadlock", ["deadlock", "be tac"],
     "tập tiến trình mà mỗi tiến trình chờ tài nguyên do tiến trình khác trong tập đang giữ → không tiến triển"),
    ("hold and wait", ["hold and wait", "giu va cho"],
     "điều kiện deadlock: tiến trình giữ ≥1 tài nguyên và đang đợi thêm tài nguyên khác"),
    ("no preemption", ["no preemption", "khong cho phep dung", "khong tiem dung", "khong tiem quyen"],
     "điều kiện deadlock: tài nguyên chỉ được giải phóng tự nguyện bởi tiến trình giữ"),
    ("circular wait", ["circular wait", "cho vong tron", "cho doi vong tron"],
     "điều kiện deadlock: tồn tại chuỗi P0→P1→…→Pn→P0 mỗi tiến trình chờ tài nguyên của tiến trình kế tiếp"),
    ("Banker's algorithm", ["banker", "nha bang"],
     "thuật toán Dijkstra tránh deadlock: trước khi cấp tài nguyên, mô phỏng xem hệ có ở safe state không"),
    ("safe state", ["safe state", "trang thai an toan"],
     "trạng thái có safe sequence — tồn tại thứ tự cấp tài nguyên để mọi tiến trình hoàn tất"),
    ("RAG", ["resource allocation graph", " rag ", "do thi cap phat tai nguyen"],
     "đồ thị có đỉnh tiến trình và tài nguyên, cạnh request P→R và assign R→P"),
    ("recovery", ["recovery", "khac phuc be tac", "khoi phuc be tac"],
     "khắc phục deadlock bằng terminate hoặc resource preemption"),
    ("rollback", ["rollback", "quay lui"],
     "đưa tiến trình về checkpoint trước đó để giải phóng tài nguyên"),

    ("address binding", ["address binding", "rang buoc dia chi"],
     "ánh xạ địa chỉ logic → vật lý có thể xảy ra ở compile-time, load-time, hoặc execution-time"),
    ("logical address", ["logical address", "dia chi logic", "dia chi ao"],
     "địa chỉ CPU sinh ra (program-relative); cần MMU dịch sang địa chỉ vật lý lúc chạy"),
    ("physical address", ["physical address", "dia chi vat ly"],
     "địa chỉ thật trên RAM mà bộ nhớ thực sự dùng để truy cập"),
    ("MMU", ["mmu", "memory management unit"],
     "phần cứng dịch địa chỉ logic → vật lý lúc chạy"),
    ("relocation register", ["relocation register", "thanh ghi tai dinh vi", "base register"],
     "thanh ghi cộng vào mọi địa chỉ logic — cho phép tiến trình di chuyển trong RAM"),
    ("limit register", ["limit register", "thanh ghi gioi han"],
     "thanh ghi chứa kích thước tối đa của tiến trình; địa chỉ vượt limit → trap để bảo vệ"),
    ("swapping", ["swapping", "trao doi"],
     "đẩy toàn bộ tiến trình ra backing store khi RAM thiếu, nạp lại khi cần"),
    ("backing store", ["backing store", "kho luu tru phu"],
     "vùng đĩa cứng dùng để lưu tiến trình bị swap-out"),
    ("contiguous allocation", ["contiguous", "lien tuc", "fixed partition", "variable partition"],
     "mỗi tiến trình chiếm một khối RAM liền nhau"),
    ("first-fit", ["first fit", "first-fit"],
     "chọn lỗ đầu tiên đủ lớn — nhanh nhất"),
    ("best-fit", ["best fit", "best-fit"],
     "chọn lỗ nhỏ nhất đủ lớn — sinh nhiều lỗ vụn"),
    ("worst-fit", ["worst fit", "worst-fit"],
     "chọn lỗ lớn nhất — giữ các lỗ to hữu ích nhưng phân tán bộ nhớ"),
    ("external fragmentation", ["external fragment", "phan manh ngoai"],
     "tổng các lỗ trống đủ lớn nhưng không liên tục → không thể cấp cho tiến trình mới"),
    ("internal fragmentation", ["internal fragment", "phan manh trong"],
     "tài nguyên cấp lớn hơn yêu cầu → phần thừa lãng phí"),
    ("compaction", ["compaction", "don dep bo nho", "gom rac"],
     "di chuyển tiến trình để gom các lỗ trống thành một khối liên tục"),
    ("paging", ["paging", "phan trang"],
     "chia bộ nhớ logic thành page và RAM thành frame cùng kích thước; mỗi tiến trình có page table"),
    ("page", [" page ", " trang "],
     "đơn vị bộ nhớ logic kích thước cố định"),
    ("frame", ["frame", "khung trang"],
     "đơn vị bộ nhớ vật lý kích thước = page"),
    ("page table", ["page table", "bang trang"],
     "bảng mỗi tiến trình ánh xạ số trang → số frame, kèm bit valid/protection"),
    ("offset", ["offset", "do lech"],
     "phần thấp của địa chỉ logic — vị trí byte trong page/frame"),
    ("TLB", [" tlb ", "translation lookaside", "associative memory"],
     "cache phần cứng nhỏ chứa các cặp (page, frame) gần nhất — tăng tốc dịch địa chỉ"),
    ("hierarchical page table", ["hierarchical", "phan cap", "multilevel page", "phan trang nhieu cap"],
     "page table chia nhiều cấp — chỉ những phần cần mới có sub-table → tiết kiệm bộ nhớ"),
    ("hashed page table", ["hashed page", "bang trang bam"],
     "tra cứu page bằng hàm băm — phù hợp không gian địa chỉ lớn"),
    ("inverted page table", ["inverted page", "bang trang nguoc"],
     "chỉ có 1 entry mỗi frame — tiết kiệm bộ nhớ nhưng tra cứu chậm"),
    ("segmentation", ["segmentation", "phan doan"],
     "chia bộ nhớ logic theo đơn vị logic (code, data, stack…) kích thước khác nhau"),
    ("segment table", ["segment table", "bang phan doan"],
     "bảng mỗi segment có base + limit"),
    ("valid-invalid bit", ["valid invalid", "valid-invalid", "valid bit", "invalid bit", "bit hop le"],
     "bit trong page table cho biết trang có thuộc không gian địa chỉ tiến trình không"),
    ("shared pages", ["shared page", "trang chia se", "reentrant"],
     "nhiều page table cùng trỏ về một frame — chia sẻ mã reentrant như libc"),
    ("memory protection", ["memory protection", "bao ve bo nho"],
     "bit bảo vệ trong page/segment table (read/write/execute) ngăn truy cập vùng cấm"),

    ("demand paging", ["demand paging", "phan trang theo yeu cau"],
     "chỉ nạp page vào RAM khi tiến trình thực sự truy cập (chương 8)"),
    ("page fault", ["page fault", "loi trang"],
     "trap khi truy cập page không có trong RAM → HĐH nạp page từ backing store (chương 8)"),
    ("LRU", [" lru ", "least recently used"],
     "thuật toán thay thế trang: bỏ trang lâu chưa được dùng nhất"),
    ("FIFO replacement", ["fifo replacement", "vao truoc ra truoc"],
     "thay thế trang vào trước nhất; có Belady's anomaly"),
]


# ------------------------------------------------------------------ #
# 2. TOPIC LIBRARY
# ------------------------------------------------------------------ #

KB: list[tuple[str, list[str], str]] = [
    (
        "OS definition / role",
        ["he dieu hanh", "operating system", "phan mem nam giua", "trung gian", "lop trung gian", "vai tro cua he"],
        "**HĐH** là phần mềm hệ thống đứng giữa **người dùng/ứng dụng** và **phần cứng**: nó quản lý tài nguyên (CPU, RAM, I/O, storage), cung cấp giao diện trừu tượng (system call, file, process), và đảm bảo bảo vệ + công bằng. HĐH **không phải** ứng dụng (Word, browser…), **không phải** thư viện (libc — chỉ là wrapper gọi syscall). Mục tiêu: tiện lợi cho user + hiệu quả cho hardware.",
    ),
    (
        "OS structures",
        ["monolithic", "microkernel", "vi nhan", "phan lop", "layered", "loadable kernel", "module"],
        "Có 4 kiến trúc kernel chính.\n\n"
        "1) **Monolithic** — mọi dịch vụ chạy chung trong kernel space. Nhanh (gọi hàm trực tiếp) nhưng khó bảo trì, một bug có thể crash cả hệ thống. Ví dụ: UNIX truyền thống.\n\n"
        "2) **Layered** — phân lớp, lớp i chỉ gọi lớp i-1. Dễ debug nhưng khó định nghĩa thứ tự lớp và overhead khi đi qua nhiều lớp.\n\n"
        "3) **Microkernel** — kernel chỉ giữ tối thiểu (IPC, lập lịch cơ bản, quản lý bộ nhớ thấp), mọi dịch vụ khác chạy ở user-mode. Bảo mật và portable hơn nhưng mọi giao tiếp đều qua IPC → chậm. Ví dụ: Mach, MINIX.\n\n"
        "4) **Modules / hybrid** — kernel cốt lõi monolithic + cho phép nạp/gỡ module runtime. Dung hòa tốc độ và linh hoạt. Linux hiện tại, Solaris, macOS dùng cách này. **Linux là monolithic kernel có loadable modules** — đó là lựa chọn chính xác.",
    ),
    (
        "system call mechanism",
        ["system call", "loi goi he thong", "syscall"],
        "**System call** là cách *duy nhất* hợp pháp cho ứng dụng yêu cầu dịch vụ HĐH (open, read, fork, exec, mmap…). Cơ chế:\n\n"
        "1) Ứng dụng đẩy số syscall + tham số lên thanh ghi/stack;\n"
        "2) Thực thi lệnh `trap`/`syscall` → CPU **chuyển user mode → kernel mode**;\n"
        "3) Kernel dispatch theo số syscall, kiểm tra tham số (an toàn!), thực thi;\n"
        "4) Đặt giá trị trả về vào thanh ghi, `iret` về user mode.\n\n"
        "Lý do thiết kế: kernel mode có quyền chạy **lệnh đặc quyền** (I/O, đặt timer, sửa bảng trang…) — user mode không được phép. User cố thực thi → trap.",
    ),
    (
        "interrupt vs trap",
        ["interrupt", "ngat", "trap", "exception", "ngoai le", "interrupt vector"],
        "**Interrupt** = bất đồng bộ, do **phần cứng** phát (bàn phím gõ, đĩa I/O xong, timer hết hạn). CPU đang làm gì thì dừng đó, lưu PC, tra **interrupt vector** để tìm địa chỉ ISR, chạy ISR, rồi trở lại.\n\n"
        "**Trap (exception)** = đồng bộ, do **phần mềm** phát: chia 0, page fault, truy cập vùng nhớ cấm, **system call**. Trap luôn xảy ra tại một lệnh xác định.\n\n"
        "Cả hai dùng cùng cơ chế (vector + ISR) nhưng nguồn khác nhau.",
    ),
    (
        "OS classes (mainframe, embedded, real-time…)",
        ["mainframe", "embedded", "nhung", "real time", "thoi gian thuc", "distributed", "phan tan",
         "da chuong trinh", "multiprogramming", "time sharing", "multitasking", "han do"],
        "**Multiprogramming** (đa chương trình): nhiều chương trình *cùng nằm trong RAM*; khi chương trình I/O thì CPU chuyển sang chương trình khác → tăng utilization. Đây là tính năng **cốt lõi** của HĐH hiện đại.\n\n"
        "**Time-sharing / multitasking**: mở rộng multi-program bằng cách chia CPU theo lát thời gian → cho cảm giác mọi user có máy riêng (interactive).\n\n"
        "**Real-time**: kết quả phải đúng *và* đúng deadline. Hard real-time (trễ = sai), soft real-time (trễ làm giảm chất lượng).\n\n"
        "**Embedded**: nhúng vào thiết bị chuyên dụng (router, ô tô, IoT) — tài nguyên ít, mục đích đặc biệt.\n\n"
        "**Distributed**: nhiều máy hợp tác qua mạng, người dùng thấy như một máy.",
    ),
    (
        "DMA",
        ["dma", "direct memory access"],
        "**DMA** cho phép thiết bị I/O đọc/ghi trực tiếp vào RAM **không qua CPU**. CPU chỉ khởi tạo (đặt nguồn, đích, độ dài) rồi đi làm việc khác; khi xong DMA controller phát interrupt báo hoàn thành. Ý nghĩa: với truyền dữ liệu lớn (đĩa, mạng), DMA giảm tải CPU đáng kể so với programmed I/O.",
    ),

    (
        "process states",
        ["new", "ready", "running", "waiting", "blocked", "terminated", "trang thai tien trinh"],
        "Tiến trình trải qua 5 trạng thái:\n"
        "- **new**: vừa tạo, chưa được long-term scheduler nhận;\n"
        "- **ready**: nằm trong ready queue, sẵn sàng chạy;\n"
        "- **running**: đang chiếm CPU;\n"
        "- **waiting (blocked)**: đang đợi sự kiện/I/O;\n"
        "- **terminated**: đã kết thúc.\n\n"
        "Các chuyển dịch quan trọng:\n"
        "- ready → running: dispatcher cấp CPU;\n"
        "- running → ready: bị tiếm quyền (timer, ưu tiên cao đến);\n"
        "- running → waiting: tiến trình tự gọi I/O hoặc wait();\n"
        "- waiting → ready: I/O xong / nhận signal;\n"
        "- running → terminated: exit() hoặc bị kill.\n\n"
        "Chỉ một tiến trình ở **running** trên một core tại mỗi thời điểm.",
    ),
    (
        "PCB",
        ["pcb", "process control block", "khoi dieu khien tien trinh"],
        "**PCB** là cấu trúc dữ liệu HĐH dùng để \"đại diện\" cho tiến trình. Nội dung:\n"
        "- **Process state** (new/ready/running/waiting/terminated);\n"
        "- **PID** + tên;\n"
        "- **Program counter** + các thanh ghi CPU (cần lưu khi context switch);\n"
        "- **Thông tin lập lịch**: priority, queue đang nằm;\n"
        "- **Thông tin quản lý bộ nhớ**: base/limit, page table pointer;\n"
        "- **Accounting**: thời gian CPU đã dùng, giới hạn;\n"
        "- **I/O**: danh sách thiết bị, file mở.\n\n"
        "Khi context switch HĐH lưu trạng thái CPU vào PCB tiến trình cũ và nạp PCB tiến trình mới. PCB là *kernel-only* — user không được truy cập trực tiếp.",
    ),
    (
        "context switch",
        ["context switch", "chuyen ngu canh", "luu trang thai cpu"],
        "**Context switch** là việc HĐH chuyển CPU từ tiến trình P1 sang P2:\n"
        "1) Lưu state CPU (PC + thanh ghi) vào PCB[P1];\n"
        "2) Cập nhật PCB[P1] (state = ready/waiting), PCB[P2] (state = running);\n"
        "3) Nạp state CPU từ PCB[P2];\n"
        "4) Trở về user mode tại PC mới.\n\n"
        "Đây là **overhead thuần** — CPU không làm việc hữu ích. Càng nhiều context switch (q nhỏ trong RR) → throughput càng giảm.",
    ),
    (
        "fork/exec/wait",
        ["fork", "exec", "tien trinh con", "process creation"],
        "**fork()** tạo tiến trình con bằng cách *sao chép* không gian địa chỉ tiến trình cha (modern: copy-on-write). Sau fork, **cha và con** chạy song song cùng đoạn mã tiếp theo nhưng với giá trị return khác nhau:\n"
        "- cha: nhận **PID con**;\n"
        "- con: nhận **0**.\n\n"
        "**exec()** thay thế hoàn toàn không gian địa chỉ tiến trình hiện tại bằng chương trình mới — không tạo tiến trình, chỉ load và bắt đầu chạy chương trình mới. Pattern phổ biến: `fork()` rồi con `exec()` để chạy chương trình khác (shell làm thế).\n\n"
        "**wait()** cho cha **block đến khi một con kết thúc** và thu trạng thái thoát. Nếu cha không gọi wait, con thành **zombie**. Nếu cha chết trước, con thành **orphan** và được init nhận làm con nuôi.",
    ),
    (
        "cooperating vs independent",
        ["tien trinh hop tac", "cooperating", "doc lap", "independent",
         "anh huong den", "anh huong boi"],
        "**Tiến trình độc lập** không thể ảnh hưởng đến / bị ảnh hưởng bởi tiến trình khác — không có dữ liệu chia sẻ. **Tiến trình hợp tác (cooperating)** thì *có thể* ảnh hưởng/bị ảnh hưởng — chia sẻ dữ liệu qua IPC. Lý do cần hợp tác: chia sẻ thông tin, tăng tốc song song, modularity, tiện lợi cho user. Lưu ý: \"tiến trình cha/con/init\" không phải đặc trưng định nghĩa — quan hệ huyết thống không quyết định việc có chia sẻ dữ liệu hay không.",
    ),
    (
        "IPC models",
        ["ipc", "shared memory", "message passing", "send", "receive", "mailbox",
         "lien lac giua tien trinh"],
        "Có **2 mô hình IPC chính**:\n\n"
        "1) **Shared memory** — các tiến trình map cùng vùng RAM. Sau khi setup, đọc/ghi nhanh như truy cập biến cục bộ. Nhược: tự đồng bộ (semaphore/mutex), khó cho hệ phân tán.\n\n"
        "2) **Message passing** — kernel cung cấp `send(dest, msg)` / `receive(src, msg)`. Có thể **direct** (chỉ tên tiến trình) hoặc **indirect** (qua mailbox/port). Có **blocking** hoặc **non-blocking**. Có **bounded buffer** hoặc **unbounded**.\n\n"
        "Trade-off: shared memory nhanh hơn vì kernel chỉ can thiệp lúc setup; message passing chậm hơn nhưng dễ mở rộng cho hệ phân tán.",
    ),
    (
        "thread benefits / models",
        ["thread", "luong", "tieu trinh", "many to one", "one to one", "many to many"],
        "**Thread** chia sẻ **code, data, heap, file mở** với các thread cùng tiến trình nhưng có **stack + thanh ghi + PC riêng**. Lợi ích:\n"
        "- **Responsiveness**: 1 thread block không kéo cả ứng dụng;\n"
        "- **Resource sharing**: chia sẻ địa chỉ tự nhiên không cần IPC;\n"
        "- **Economy**: tạo thread rẻ hơn tạo process ~10-30 lần;\n"
        "- **Scalability**: tận dụng đa lõi.\n\n"
        "**3 mô hình** ánh xạ user thread ↔ kernel thread:\n"
        "- **many-to-one**: nhiều user-thread ↔ 1 kernel thread → đơn giản nhưng 1 thread block là cả tiến trình block;\n"
        "- **one-to-one**: 1 user ↔ 1 kernel — chạy song song thật, Linux/Windows dùng;\n"
        "- **many-to-many**: M user ↔ N kernel (M≥N) — linh hoạt nhất, ít HĐH dùng.",
    ),

    (
        "scheduling criteria",
        ["cpu utilization", "throughput", "thong luong", "turnaround", "waiting time",
         "thoi gian cho", "response time", "thoi gian phan hoi", "tieu chi lap lich"],
        "5 tiêu chí đánh giá lập lịch CPU:\n"
        "- **CPU utilization** (max): % thời gian CPU bận;\n"
        "- **Throughput** (max): số tiến trình hoàn thành / đơn vị thời gian;\n"
        "- **Turnaround time** (min): từ submit đến kết thúc;\n"
        "- **Waiting time** (min): tổng thời gian trong ready queue;\n"
        "- **Response time** (min): từ submit đến *bắt đầu phản hồi đầu tiên*.\n\n"
        "*Waiting time* khác *turnaround time*: turnaround = waiting + CPU + I/O. SJF tối ưu *waiting time trung bình* — đây là kết quả chứng minh được.",
    ),
    (
        "FCFS",
        ["fcfs", "first come first served", "den truoc phuc vu truoc"],
        "**FCFS** chọn tiến trình theo thứ tự đến ready queue, **không tiếm quyền**. Đơn giản (FIFO queue), nhưng:\n\n"
        "- Phụ thuộc thứ tự đến: cùng tập tiến trình, thứ tự khác → waiting time trung bình rất khác.\n"
        "- **Convoy effect**: 1 tiến trình CPU-bound dài chặn các tiến trình I/O-bound ngắn → throughput thấp.\n"
        "- Không phù hợp time-sharing.\n\n"
        "Ví dụ: P1=24, P2=3, P3=3 đến cùng lúc → AWT = (0+24+27)/3 = 17. Đảo P2,P3,P1 → AWT = (0+3+6)/3 = 3.",
    ),
    (
        "SJF / SRTF",
        ["sjf", "shortest job first", "srtf", "shortest remaining", "ngan nhat truoc",
         "exponential averaging", "du doan burst"],
        "**SJF** chọn tiến trình có **CPU burst kế tiếp ngắn nhất**. SJF **tối ưu waiting time trung bình** trong số mọi thuật toán. Phiên bản tiếm quyền là **SRTF**.\n\n"
        "Khó khăn: **không biết trước burst tiếp theo**. Giải pháp: dự đoán bằng exponential averaging:\n\n"
        "$$\\tau_{n+1} = \\alpha \\cdot t_n + (1-\\alpha) \\cdot \\tau_n$$\n\n"
        "với α∈[0,1]. α=0 → chỉ dùng dự đoán cũ; α=1 → chỉ dùng burst gần nhất.",
    ),
    (
        "Round Robin",
        ["round robin", "rr ", "quay vong", "time quantum", "luong tu thoi gian"],
        "**Round Robin** = FCFS + tiếm quyền theo **time quantum q**. Mỗi tiến trình chạy ≤ q rồi bị chuyển ra cuối ready queue. Đặc tính:\n\n"
        "- Nếu có n tiến trình, mỗi tiến trình chờ tối đa **(n-1)·q**;\n"
        "- **q quá nhỏ** → quá nhiều context switch (overhead);\n"
        "- **q quá lớn** → suy biến thành FCFS.\n\n"
        "Quy tắc: chọn q sao cho **80% CPU burst < q**. RR tốt cho time-sharing nhưng *không tối ưu* waiting time trung bình.",
    ),
    (
        "priority + starvation/aging",
        ["priority", "uu tien", "starvation", "nan doi", "aging", "lao hoa"],
        "**Priority scheduling** chọn tiến trình có độ ưu tiên cao nhất. Có thể tiếm quyền hoặc không.\n\n"
        "Vấn đề chính: **starvation (nạn đói)** — tiến trình ưu tiên thấp có thể chờ vô thời hạn nếu liên tục có tiến trình ưu tiên cao đến. Giải pháp kinh điển: **aging (lão hóa)** — tăng độ ưu tiên theo thời gian chờ. Sau đủ lâu, mọi tiến trình đều leo lên đỉnh.\n\n"
        "Lưu ý: **starvation ≠ deadlock**. Starvation = bị bỏ qua mãi (vẫn có tiến trình khác chạy). Deadlock = mọi người đều kẹt.",
    ),
    (
        "multilevel queue / feedback",
        ["multilevel", "da muc", "feedback queue", "hoi tiep", "nhieu hang doi"],
        "**Multilevel queue**: chia ready queue thành nhiều hàng theo loại tiến trình (foreground = RR, background = FCFS). Mỗi hàng có thuật toán riêng. Tiến trình **không di chuyển** giữa các hàng.\n\n"
        "**Multilevel feedback queue**: tiến trình **có thể di chuyển** dựa trên hành vi:\n"
        "- CPU-bound (dùng hết quantum) → xuống hàng thấp hơn;\n"
        "- I/O-bound (block sớm) → giữ hoặc lên hàng cao hơn.\n\n"
        "Aging cũng có thể implement bằng feedback queue. Đây là thuật toán **tổng quát nhất** và gần như mọi HĐH hiện đại dùng.",
    ),
    (
        "scheduler types (long/short/medium)",
        ["long term", "long-term", "short term", "short-term", "medium term", "medium-term",
         "dai han", "ngan han", "trung han"],
        "Ba bộ lập lịch hoạt động ở 3 mức thời gian:\n\n"
        "**Long-term (job scheduler)**: chọn tiến trình từ pool đưa vào ready queue. Kiểm soát **mức đa chương**. Gọi *ít thường xuyên* (giây-phút).\n\n"
        "**Short-term (CPU scheduler)**: chọn tiến trình *trong ready queue* để cấp CPU. Gọi *rất thường xuyên* (mili-giây) → phải nhanh.\n\n"
        "**Medium-term**: liên quan **swapping** — đẩy tiến trình ra disk, đưa vào lại sau. Quản lý mức đa chương động.",
    ),
    (
        "dispatcher",
        ["dispatcher", "bo dieu phoi", "dispatch latency", "do tre dieu phoi"],
        "**Dispatcher** là module thực thi việc chuyển CPU sang tiến trình do scheduler chọn. Công việc:\n"
        "1) Context switch (lưu/khôi phục thanh ghi);\n"
        "2) Chuyển CPU sang user mode;\n"
        "3) Nhảy đến đúng PC tiến trình mới.\n\n"
        "**Dispatch latency** = thời gian dispatcher dừng tiến trình cũ + khởi động tiến trình mới. Cần tối thiểu hóa, đặc biệt cho real-time.",
    ),
    (
        "Gantt / waiting calc",
        ["gantt", "tinh thoi gian cho", "tinh waiting", "trung binh"],
        "Cách tính waiting/turnaround từ Gantt chart:\n\n"
        "- **Turnaround[i]** = (thời điểm kết thúc[i]) − (thời điểm đến[i]);\n"
        "- **Waiting[i]** = Turnaround[i] − (CPU burst[i]) − (tổng I/O burst[i]);\n"
        "- **Trung bình** = trung bình cộng.\n\n"
        "Với SJF/SRTF, khi nhiều tiến trình có burst bằng nhau ta dùng FCFS làm tiebreak.",
    ),

    (
        "race + critical section requirements",
        ["race condition", "critical section", "vung gang", "mien gang", "doan gang",
         "khu vuc quan trong", "vung tranh chap", "mutual exclusion", "progress", "bounded waiting"],
        "**Race condition** xảy ra khi nhiều thread truy cập đồng thời cùng dữ liệu chia sẻ và ≥1 thread *ghi*; kết quả phụ thuộc thứ tự thực thi không xác định. Đoạn mã thao tác dữ liệu chia sẻ gọi là **critical section (CS)**.\n\n"
        "Một lời giải đồng bộ CS phải thỏa **3 yêu cầu**:\n\n"
        "1) **Mutual exclusion**: chỉ một tiến trình ở trong CS tại mỗi thời điểm.\n"
        "2) **Progress**: nếu CS rỗng và có tiến trình muốn vào, không thể trì hoãn vô hạn việc chọn ai.\n"
        "3) **Bounded waiting**: phải có giới hạn số lần các tiến trình khác được vào CS trước khi tiến trình này được vào.\n\n"
        "Thiếu một trong ba là lời giải sai.",
    ),
    (
        "Peterson",
        ["peterson"],
        "**Peterson** giải CS cho **2 tiến trình** bằng 2 biến chia sẻ:\n"
        "- `flag[i]` (boolean): tiến trình i muốn vào CS;\n"
        "- `turn` (int): đến lượt ai.\n\n"
        "Code cho tiến trình i:\n"
        "```\n"
        "flag[i] = true;\n"
        "turn = j;\n"
        "while (flag[j] && turn == j) ;   // busy wait\n"
        "// CRITICAL SECTION\n"
        "flag[i] = false;\n"
        "```\n\n"
        "Thỏa cả 3 yêu cầu (mutex, progress, bounded waiting). Giả định **bộ nhớ ghi tuần tự** — trên CPU hiện đại có reordering, cần memory barrier.",
    ),
    (
        "semaphore",
        ["semaphore", "wait", "signal", "p()", "v()", "den bao", "binary semaphore", "counting semaphore"],
        "**Semaphore S** là biến số nguyên với **2 thao tác nguyên tử**:\n\n"
        "- **wait(S) / P(S)**: while (S ≤ 0); S--;\n"
        "- **signal(S) / V(S)**: S++;\n\n"
        "Hiện thực thực tế dùng waiting queue thay busy-wait: wait giảm S; nếu S < 0 thì block tiến trình; signal tăng S; nếu có tiến trình đang đợi thì wake một.\n\n"
        "Hai loại:\n"
        "- **Binary semaphore** (S ∈ {0,1}) hoạt động như **mutex lock**;\n"
        "- **Counting semaphore** (S = N) — quản lý N bản sao tài nguyên.\n\n"
        "Cài CS: init S=1; trước CS gọi wait(S); sau CS gọi signal(S).",
    ),
    (
        "monitor + condition variable",
        ["monitor", "condition variable", "bien dieu kien", "hoare", "mesa"],
        "**Monitor** là construct ngôn ngữ (Java `synchronized`) đóng gói:\n"
        "- biến chia sẻ;\n"
        "- thủ tục thao tác;\n"
        "- bảo đảm **mutual exclusion tự động**.\n\n"
        "**Condition variable** dùng cho đồng bộ điều kiện:\n"
        "- `x.wait()`: giải phóng monitor + chờ x.signal();\n"
        "- `x.signal()`: nếu có thread đang wait x thì đánh thức 1.\n\n"
        "Hai semantic:\n"
        "- **Hoare-style**: signaler nhường monitor ngay;\n"
        "- **Mesa-style** (Java): signal chỉ là gợi ý, waker phải đua lại → cần bọc bằng `while (!cond) cv.wait();`.\n\n"
        "Khác semaphore: monitor cao cấp + tự bảo đảm mutex; semaphore thấp cấp + dễ dùng sai.",
    ),
    (
        "producer-consumer / bounded buffer",
        ["producer", "consumer", "san xuat", "tieu thu", "bounded buffer", "buffer co han"],
        "Bài toán **bounded buffer**: producer tạo item ghi vào buffer kích thước N, consumer đọc và xử lý.\n\n"
        "Lời giải kinh điển dùng **3 semaphore**:\n"
        "- `mutex = 1` (bảo vệ buffer);\n"
        "- `empty = N` (số ô trống);\n"
        "- `full = 0` (số ô đầy).\n\n"
        "**Producer**: `wait(empty); wait(mutex); enqueue; signal(mutex); signal(full);`\n"
        "**Consumer**: `wait(full); wait(mutex); dequeue; signal(mutex); signal(empty);`\n\n"
        "Lưu ý thứ tự: phải `wait(empty)` *trước* `wait(mutex)` — đảo ngược → deadlock.",
    ),
    (
        "readers-writers",
        ["readers writers", "doc viet", "doc ghi"],
        "**Readers-writers**: nhiều **reader** đọc đồng thời được; **writer** cần truy cập độc quyền.\n\n"
        "Biến thể 1 (ưu tiên reader): nếu có reader đang đọc, reader mới *được vào ngay* → writer có thể **starve**.\n\n"
        "Biến thể 2 (ưu tiên writer): writer đợi sẽ vào trước reader mới → reader có thể starve.\n\n"
        "Lời giải dùng `mutex` bảo vệ `read_count` + `wrt` semaphore writer giành. Reader đầu tiên: wait(wrt); reader cuối: signal(wrt).",
    ),
    (
        "dining philosophers",
        ["dining philosophers", "triet gia", "an com", " dua "],
        "**5 triết gia** ngồi quanh bàn, giữa mỗi cặp có 1 đũa.\n\n"
        "**Lời giải naive**: mỗi đũa = 1 semaphore = 1; mỗi triết gia: lấy đũa trái, lấy đũa phải, ăn, đặt đũa.\n\n"
        "→ **Deadlock** khi mọi triết gia cùng lấy đũa trái: circular wait. Minh họa kinh điển 4 điều kiện deadlock.\n\n"
        "**Khắc phục**:\n"
        "1) Cho phép tối đa 4 triết gia ngồi → phá *hold and wait*;\n"
        "2) Đánh số đũa, lấy đũa số nhỏ trước → phá *circular wait*;\n"
        "3) Atomic check 2 đũa cùng rảnh — dùng monitor.",
    ),

    (
        "4 deadlock conditions",
        ["mutual exclusion", "hold and wait", "no preemption", "circular wait",
         "khong tiem dung", "khong cho phep dung", "loai tru lan nhau", "giu va cho",
         "vong tron", "4 dieu kien", "dong thoi", "4 dk"],
        "**Deadlock xảy ra ⇔ tất cả 4 điều kiện đồng thời thỏa**:\n\n"
        "1) **Mutual exclusion (loại trừ lẫn nhau)** — tài nguyên không chia sẻ được, mỗi lúc chỉ 1 tiến trình giữ.\n"
        "2) **Hold and wait (giữ và chờ)** — tiến trình giữ ≥1 tài nguyên đang đợi thêm tài nguyên khác.\n"
        "3) **No preemption (không tiếm quyền)** — tài nguyên chỉ được giải phóng tự nguyện.\n"
        "4) **Circular wait (chờ vòng tròn)** — tồn tại chuỗi P0→P1→…→Pn→P0, mỗi tiến trình đợi tài nguyên do tiến trình kế tiếp giữ.\n\n"
        "**Phá vỡ 1 trong 4 → ngăn deadlock**. Mutual exclusion thường không thể phá. Hold-and-wait phá bằng yêu cầu mọi tài nguyên trước. No preemption phá bằng cho phép cướp + rollback. Circular wait phá bằng đánh thứ tự tài nguyên và chỉ cấp theo thứ tự tăng.",
    ),
    (
        "RAG",
        ["resource allocation graph", " rag ", "do thi cap phat", "chu trinh", " cycle "],
        "**Resource Allocation Graph (RAG)**:\n"
        "- Đỉnh: tiến trình P (vòng tròn) và tài nguyên R (hình chữ nhật);\n"
        "- Cạnh **request**: P → R (P đang đợi R);\n"
        "- Cạnh **assignment**: R → P (1 instance của R cấp cho P).\n\n"
        "Tính chất:\n"
        "- **Mỗi tài nguyên có 1 instance**: chu trình ⇔ deadlock;\n"
        "- **Nhiều instance**: chu trình là điều kiện *cần* nhưng *không đủ*.\n\n"
        "Đồ thị acyclic → chắc chắn không deadlock.",
    ),
    (
        "Banker's algorithm",
        ["banker", "nha bang", "safe state", "trang thai an toan", "safe sequence",
         "max", "need", "available", "allocation", "tranh be tac"],
        "**Banker's algorithm** (Dijkstra) là *deadlock avoidance*: trước khi cấp tài nguyên, mô phỏng và kiểm tra **safe state**.\n\n"
        "Cấu trúc dữ liệu:\n"
        "- `Available[m]`: số instance còn lại;\n"
        "- `Max[n][m]`: nhu cầu tối đa (phải khai báo trước!);\n"
        "- `Allocation[n][m]`: đã cấp;\n"
        "- `Need = Max − Allocation`.\n\n"
        "**Safety check**:\n"
        "1) Work = Available, Finish[i] = false;\n"
        "2) Tìm i: Finish[i]=false và Need[i] ≤ Work;\n"
        "3) Work += Allocation[i]; Finish[i] = true; quay lại 2;\n"
        "4) Mọi Finish = true → **safe**; không → unsafe.\n\n"
        "**Giới hạn**: cần biết Max trước, số tiến trình/tài nguyên cố định — khó dùng thực tế.",
    ),
    (
        "deadlock recovery",
        ["recovery", "khac phuc be tac", "khoi phuc be tac", "victim", "rollback"],
        "Khắc phục deadlock:\n\n"
        "**1) Process termination**:\n"
        "- *Abort all*: giết hết — tốn kém;\n"
        "- *Abort one at a time*: giết từng tiến trình + check còn deadlock không.\n\n"
        "**2) Resource preemption**:\n"
        "- Chọn nạn nhân + tài nguyên cướp;\n"
        "- **Rollback** tiến trình về checkpoint;\n"
        "- Tránh **starvation**: giới hạn số lần một tiến trình bị chọn nạn nhân.\n\n"
        "**3) Ignore (Ostrich)**: Linux/Windows mặc định vì deadlock hiếm.",
    ),

    (
        "address binding times",
        ["address binding", "rang buoc dia chi", "compile time", "load time",
         "execution time", "thoi diem rang buoc"],
        "**Address binding** = dịch tham chiếu *symbolic* → địa chỉ vật lý. Có thể xảy ra ở 3 thời điểm:\n\n"
        "**1) Compile-time**: compiler sinh mã tuyệt đối. Tiến trình *phải* nạp đúng vị trí định trước.\n\n"
        "**2) Load-time**: compiler sinh mã *relocatable*. Loader bind khi nạp vào RAM. Sau đó cố định.\n\n"
        "**3) Execution-time**: bind mỗi lần truy cập, dùng **MMU**. Tiến trình *có thể di chuyển* trong RAM khi đang chạy → cần thiết cho swapping, paging, compaction. HĐH hiện đại dùng cách này.",
    ),
    (
        "MMU / logical vs physical",
        ["mmu", "logical address", "physical address", "dia chi logic", "dia chi vat ly",
         "dia chi ao", "relocation register", "thanh ghi tai dinh vi", "limit register"],
        "**MMU** (Memory Management Unit) là phần cứng dịch địa chỉ logic → vật lý lúc chạy.\n\n"
        "Sơ đồ đơn giản nhất (relocation):\n"
        "- **Relocation register** chứa địa chỉ bắt đầu của tiến trình trong RAM;\n"
        "- **Limit register** chứa kích thước tiến trình;\n"
        "- Mỗi địa chỉ logic d: nếu d < limit → physical = d + relocation; ngược lại trap → bảo vệ.\n\n"
        "Quan điểm tiến trình: chỉ thấy địa chỉ logic [0, limit). Không cần biết vị trí thật trong RAM.",
    ),
    (
        "swapping",
        ["swapping", "trao doi", "swap in", "swap out", "backing store"],
        "**Swapping**: khi RAM thiếu, HĐH đẩy *toàn bộ* tiến trình ra **backing store** (đĩa) → giải phóng RAM. Khi cần lại, swap-in.\n\n"
        "Chi phí: chủ yếu là **I/O đĩa** (chậm hơn RAM 5-6 cấp). Swap được control bởi **medium-term scheduler**. HĐH hiện đại dùng **swap theo trang** (demand paging — chương 8) thay swap toàn tiến trình.",
    ),
    (
        "contiguous allocation + fragmentation",
        ["contiguous", "lien tuc", "phan vung", "fixed partition", "variable partition",
         "first fit", "best fit", "worst fit", "external fragment", "internal fragment",
         "phan manh ngoai", "phan manh trong", "compaction", "lo trong", "hole"],
        "**Cấp phát liên tục**: mỗi tiến trình chiếm 1 khối RAM **liền nhau**.\n\n"
        "**Multiple-partition variable**: HĐH duy trì danh sách các *hole*. Khi cần X bytes:\n"
        "- **First-fit**: lỗ đầu tiên đủ lớn — *nhanh nhất*;\n"
        "- **Best-fit**: lỗ nhỏ nhất đủ lớn — sinh nhiều mảnh vụn;\n"
        "- **Worst-fit**: lỗ lớn nhất — phân tán bộ nhớ.\n\n"
        "First-fit và best-fit *tương đương* về sử dụng bộ nhớ; first-fit thắng về tốc độ.\n\n"
        "**External fragmentation**: tổng các hole đủ lớn nhưng không liền → không cấp được. Quy luật 50%: ~33% bộ nhớ có thể bị frag. Khắc phục: **compaction** (chỉ làm được khi binding execution-time).\n\n"
        "**Internal fragmentation**: chỉ xảy ra với fixed-partition hoặc paging — phần thừa *bên trong* khối được cấp. Cấp phát liên tục variable-partition **không có** internal fragmentation.",
    ),
    (
        "paging",
        ["paging", "phan trang", " page ", " frame ", "trang", "khung trang",
         "page number", "offset", "do lech", "so trang"],
        "**Paging** chia bộ nhớ logic thành **page** và RAM thành **frame** *cùng kích thước* (luỹ thừa 2, thường 4KB). Page và frame không cần liên tục → loại bỏ external fragmentation.\n\n"
        "Địa chỉ logic chia 2 phần:\n"
        "- **page number p** (bits cao): chỉ mục trong page table;\n"
        "- **offset d** (bits thấp): vị trí trong page.\n\n"
        "Với page size 2^k: offset = k bit thấp.\n\n"
        "Mỗi tiến trình có **page table** (lưu trong RAM). Truy cập (p, d):\n"
        "1) Tra page table → frame f;\n"
        "2) Địa chỉ vật lý = f * page_size + d.\n\n"
        "**Internal fragmentation** vẫn có (trang cuối tiến trình thường không đầy — trung bình nửa trang lãng phí).",
    ),
    (
        "TLB",
        [" tlb ", "translation lookaside", "associative memory", "bo nho ket hop",
         "hit ratio", "ti le truy cap", " eat ", "effective access"],
        "Vấn đề của paging: mỗi truy cập user → 2 truy cập RAM (1 tra page table + 1 dữ liệu) → chậm gấp đôi.\n\n"
        "**TLB** (Translation Lookaside Buffer) là cache phần cứng nhỏ chứa các cặp (page#, frame#) gần nhất, tra cứu *song song*.\n\n"
        "**Effective Access Time (EAT)**:\n\n"
        "$$EAT = h \\cdot (c + m) + (1 - h) \\cdot (c + 2m)$$\n\n"
        "với h = TLB hit ratio, c = TLB lookup, m = memory access. Ví dụ h=0.98, c=1, m=100 → EAT = 102ns (chỉ chậm 2%).\n\n"
        "**Context switch**: TLB chứa mapping của tiến trình hiện tại → khi chuyển phải **flush TLB** hoặc dùng **ASID**.",
    ),
    (
        "page table structures",
        ["multilevel page", "phan trang nhieu cap", "hierarchical page",
         "hashed page", "bang trang bam", "inverted page", "bang trang nguoc"],
        "Vấn đề: 32-bit + page 4KB → 2^20 entry/process × 4 byte = 4MB page table. Giải pháp:\n\n"
        "**1) Hierarchical (multi-level)**: chia page number thành nhiều phần. Page table outer chứa pointer đến inner. Chỉ phần *thực dùng* mới có inner table → tiết kiệm. Chi phí: thêm 1 truy cập RAM mỗi miss.\n\n"
        "**2) Hashed page table**: hash(p) → entry chứa (page#, frame#, next). Phù hợp 64-bit.\n\n"
        "**3) Inverted page table**: chỉ có **1 entry mỗi frame thực** — kích thước = số frame. Tra cứu chậm (tuyến tính) → kết hợp hash để tăng tốc. Một bảng chung cho cả hệ thống.",
    ),
    (
        "segmentation",
        ["segmentation", "phan doan", "segment table", "segment number"],
        "**Segmentation** chia bộ nhớ logic theo **đơn vị logic** (code, data, stack, heap, library…) **kích thước khác nhau**. Trùng với cách lập trình viên nhìn chương trình.\n\n"
        "Địa chỉ logic = **(s, d)** với s = segment number, d = offset trong segment.\n\n"
        "**Segment table**: mỗi entry có **base** + **limit**. Truy cập:\n"
        "1) Nếu d ≥ limit[s] → trap;\n"
        "2) Ngược lại physical = base[s] + d.\n\n"
        "Lợi: chia sẻ và bảo vệ ở cấp segment có ý nghĩa.\n\n"
        "Nhược: vì segment kích thước khác → **external fragmentation**. Khắc phục: kết hợp **segmentation + paging** (Intel x86 32-bit dùng).",
    ),
    (
        "shared pages / reentrant",
        ["shared page", "trang chia se", "reentrant", "tai vao", "ma chi doc"],
        "Hai (hoặc nhiều) tiến trình **có thể chia sẻ cùng frame** bằng cách page table cùng trỏ về frame đó. Yêu cầu: mã được chia sẻ phải là **reentrant** — không tự sửa, không lưu trạng thái cục bộ trong code segment.\n\n"
        "Lợi: 40 user cùng chạy editor → chỉ giữ 1 bản code editor trong RAM. Phổ biến với: thư viện chia sẻ (libc.so), trình soạn thảo, compiler.",
    ),
    (
        "memory protection / valid bit",
        ["memory protection", "bao ve bo nho", "valid bit", "valid invalid",
         "invalid bit", "bit hop le", "rwx", "read write execute"],
        "Bảo vệ bộ nhớ trong paging dùng các bit phụ trong **page table entry**:\n"
        "- **valid/invalid bit**: trang có thuộc không gian địa chỉ tiến trình không. Truy cập invalid → trap.\n"
        "- **protection bits (R/W/X)**: cho phép đọc/ghi/thực thi. Ghi vào trang RO → trap.\n\n"
        "Vì page table cấp theo nhu cầu, các trang ngoài kích thước thực được đánh invalid → bắt được nếu chương trình truy cập quá.",
    ),
]


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def best_match(text_fold: str, ans_fold: str) -> Optional[tuple[str, str]]:
    score_best = 0
    pick = None
    combined = " " + text_fold + " " + ans_fold + " "
    for topic, kws, body in KB:
        score = sum(1 for kw in kws if kw in combined)
        if score > score_best:
            score_best = score
            pick = (topic, body)
    return pick if score_best >= 1 else None


def find_glossary_terms(text_fold: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    padded = " " + text_fold + " "
    for term, kws, defn in GLOSSARY:
        if term in seen:
            continue
        for kw in kws:
            if kw in padded:
                out.append((term, defn))
                seen.add(term)
                break
    return out


CHAPTER_BLURB = {
    "1-2": "Câu này thuộc **Ch 1-2** (Tổng quan & Cấu trúc HĐH).",
    "3-4": "Câu này thuộc **Ch 3-4** (Tiến trình & Lập lịch CPU).",
    "5-6": "Câu này thuộc **Ch 5-6** (Đồng bộ & Bế tắc).",
    "7": "Câu này thuộc **Ch 7** (Quản lý bộ nhớ chính).",
    "8": "Câu này thuộc **Ch 8** (Bộ nhớ ảo, ngoài giữa kỳ).",
    "unknown": "Câu này chưa rõ chương — kiểm tra lại nguồn gốc.",
}


def is_theory(q: dict) -> bool:
    t = fold(q["question_text"])
    bad = [
        "tinh ", "bao nhieu", "ket qua la", "gia tri la",
        "thoi gian cho la", "thoi gian doi la", "thoi gian quay vong la",
        "average", "trung binh la",
    ]
    if any(b in t for b in bad):
        return False
    if q.get("qtype") == "numeric":
        return False
    if re.search(r"\bp\d+\b.*\b(\d+\s*(ms|s)\b)", t):
        return False
    return True


def numeric_hint(q: dict, correct_text: str) -> Optional[str]:
    t = fold(q["question_text"]) + " " + fold(correct_text)
    is_calc = q.get("qtype") == "numeric" or any(
        kw in t for kw in ["tinh ", "bao nhieu", "trung binh", "average", "gantt"]
    )
    if not is_calc:
        return None
    if "thoi gian cho" in t or "waiting" in t:
        return (
            "**Cách tính waiting time**: với mỗi tiến trình, *waiting time = thời điểm bắt "
            "đầu chạy − thời điểm đến* (cho non-preemptive); với preemptive cộng dồn các "
            "khoảng nằm trong ready queue. *Trung bình* = tổng / số tiến trình. Vẽ Gantt "
            "chart trước rồi đọc khoảng waiting cho từng tiến trình."
        )
    if "turnaround" in t or "thoi gian quay vong" in t or "hoan thanh" in t:
        return (
            "**Turnaround time = thời điểm kết thúc − thời điểm đến**. Bao gồm cả thời "
            "gian CPU + waiting + I/O. Trung bình = tổng / số tiến trình."
        )
    if "eat" in t or "effective access" in t or "hit ratio" in t or "tlb" in t:
        return (
            "**EAT formula**:\n\n"
            "$$EAT = h \\cdot (c + m) + (1 - h) \\cdot (c + 2m)$$\n\n"
            "với h = TLB hit ratio, c = TLB lookup, m = memory access."
        )
    if "page fault" in t or "thay the trang" in t:
        return (
            "**Đếm page fault**: mô phỏng theo reference string. Mỗi truy cập trang không "
            "có trong frame → page fault + áp dụng thuật toán thay thế. FIFO có **Belady's "
            "anomaly**; LRU và OPT thuộc lớp stack algorithm — không có anomaly."
        )
    return None


def explain_distractor(c: dict, correct_text: str) -> str:
    text = c["text"].strip().rstrip(".")
    text_fold = fold(text)

    if "phuong an tren deu sai" in text_fold or "deu sai" in text_fold:
        return f"\"*{text}*\" — phủ định toàn bộ. Vì có ít nhất một đáp án khác đúng nên đây sai."
    if "deu dung" in text_fold:
        return f"\"*{text}*\" — \"tất cả đều đúng\" chỉ chính xác khi mọi lựa chọn khác đều đúng; ở câu này không phải vậy."
    if "khong co" in text_fold and ("phuong an" in text_fold or "dap an" in text_fold):
        return f"\"*{text}*\" — không có đáp án trong các lựa chọn còn lại trùng với khái niệm đúng."

    correct_fold = fold(correct_text)
    hits: list[tuple[str, str]] = []
    padded = " " + text_fold + " "
    correct_padded = " " + correct_fold + " "
    for term, kws, defn in GLOSSARY:
        in_distractor = any(kw in padded for kw in kws)
        in_correct = any(kw in correct_padded for kw in kws)
        if in_distractor and not in_correct:
            hits.append((term, defn))
            if len(hits) >= 2:
                break

    if hits:
        parts = [f"\"*{text}*\" sai vì:"]
        for term, defn in hits:
            parts.append(f"- **{term}**: {defn} → không phải khái niệm câu này hỏi.")
        return "\n".join(parts)

    if correct_text:
        return (
            f"\"*{text}*\" — không khớp định nghĩa câu hỏi yêu cầu. Đáp án đúng là "
            f"\"*{correct_text}*\" (xem giải thích chính ở trên)."
        )
    return f"\"*{text}*\" không phải khái niệm câu hỏi đề cập."


def build_explanation(q: dict) -> dict:
    correct_labels = q.get("correct_labels") or []
    correct_text = ""
    if correct_labels:
        for c in q["choices"]:
            if c["label"] in correct_labels:
                correct_text = c["text"]
                break

    text_fold = fold(q["question_text"])
    ans_fold = fold(correct_text)

    parts: list[str] = []

    if q.get("confidence", 0) >= 0.85 and correct_labels:
        labels_up = ", ".join(l.upper() for l in correct_labels)
        if q.get("qtype") == "numeric":
            parts.append(f"**Đáp án: {q.get('numeric_answer') or labels_up}**.")
        else:
            parts.append(f"**Đáp án đúng: {labels_up}** — *{correct_text}*.")
    elif correct_labels:
        labels_up = ", ".join(l.upper() for l in correct_labels)
        parts.append(
            f"**Đáp án (cần review, conf {q.get('confidence', 0):.2f}): {labels_up}** — "
            f"*{correct_text}*. Đối chiếu slide nếu nghi ngờ."
        )
    else:
        parts.append("⚠️ Câu này **chưa có đáp án xác nhận** trong bank. Vào *Review* để chỉnh.")

    match = best_match(text_fold, ans_fold)
    topic = None
    if match:
        topic, body = match
        parts.append(body)
    else:
        hits = find_glossary_terms(ans_fold + " " + text_fold)[:4]
        if hits:
            kb_lines = ["**Khái niệm liên quan**:"]
            for term, defn in hits:
                kb_lines.append(f"- **{term}**: {defn}")
            parts.append("\n".join(kb_lines))
        parts.append(CHAPTER_BLURB.get(q.get("chapter", "unknown"), ""))

    nh = numeric_hint(q, correct_text)
    if nh:
        parts.append(nh)

    distractors: dict[str, str] = {}
    if (q.get("qtype") == "single"
            and q.get("confidence", 0) >= 0.7
            and len(q.get("choices", [])) >= 2):
        for c in q["choices"]:
            if c["label"] in correct_labels:
                continue
            distractors[c["label"]] = explain_distractor(c, correct_text)

    out = {
        "why": "\n\n".join(p for p in parts if p),
        "source": "auto",
    }
    if distractors:
        out["distractors"] = distractors
    if topic:
        out["topic"] = topic
    return out


def main():
    with QUESTIONS_PATH.open() as f:
        questions = json.load(f)

    out: dict[str, dict] = {}
    matched = 0
    theory_count = 0
    for q in questions:
        out[q["id"]] = build_explanation(q)
        if "topic" in out[q["id"]]:
            matched += 1
        q["is_theory"] = is_theory(q)
        if q["is_theory"]:
            theory_count += 1

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    with QUESTIONS_PATH.open("w") as f:
        json.dump(questions, f, ensure_ascii=False, indent=1)

    print(f"wrote {OUT_PATH}: {len(out)} explanations, {matched} matched a deep topic")
    print(f"theory_count: {theory_count}/{len(questions)}")


if __name__ == "__main__":
    main()
