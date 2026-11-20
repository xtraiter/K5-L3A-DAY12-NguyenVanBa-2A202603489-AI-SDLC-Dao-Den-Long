# Đảo Đèn Lồng

> Video demo: *(thêm ở Phase 4)* · Chơi online: *(link Cloudflare Pages, xem mục "Chơi online")*

Game 3D góc nhìn thứ ba chạy trên trình duyệt. Bạn điều khiển **Mây**, người giữ đèn nhỏ tuổi đội nón lá, quàng khăn đỏ. Qua **ba đêm** (Đảo Bến, Đảo Cau, Đảo Chuông), Mây gom đom đóm để thắp lại các Đèn Lồng Lớn trước bình minh, né **Bóng Mực** và **Gió Lạc** trong sương đen.

- Engine: Three.js r160 (đã đóng gói sẵn trong `vendor/`). Logic game viết bằng JavaScript thuần trong `src/sim/`, dùng chung cho bản web và chế độ headless.
- Chạy trên macOS, Linux hoặc Windows. Chỉ cần **Node.js ≥ 18**; không có thư viện npm nào phải cài.
- Đề bài lab gốc nằm ở [docs/lab/](docs/lab/README.md).

## Cài đặt và chạy

```bash
npm install        # không có dependency, chỉ kiểm tra môi trường
npm start          # mở http://localhost:8080 trên trình duyệt
npm test           # chạy toàn bộ test (42 test)
```

Chế độ headless (Test Contract v1.1):

```bash
node src/headless.mjs --seed 1 --night 1|2|3 --ticks 3600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

## Chơi online (Cloudflare Pages)

Bản web là thư mục tĩnh, tạo bằng `npm run build:web` (ra thư mục `dist/`). Cloudflare Pages được nối với repo này: mỗi lần push lên `main`, Cloudflare tự build lại với build command `npm run build:web` và thư mục output `dist`.

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D (hoặc ↑ ↓) | Di chuyển theo hướng camera |
| Kéo chuột / ← → | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Space | Nhảy |
| Shift | Lướt (14 m/s trong 0,2 s, hồi chiêu 1,5 s) |
| E | Nạp đom đóm vào đèn gần nhất (trong 2 m) |
| F | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong bán kính 5 m |
| Esc / P | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |
| Enter | Vào đêm |

## Luật chơi và cách tính điểm (số chuẩn Ticket-02)

- Đi gần đom đóm (≤ 1 m) là tự nhặt; mang tối đa **10** con. Mỗi đèn cần **10** đom đóm, nạp được nhiều lần.
- Bóng Mực phát hiện Mây trong 12 m, bỏ đuổi khi xa hơn 18 m, chạy 4 m/s (Đêm 3: 4,5 m/s). Bị chạm thì mất 1 Ngọn Lửa, rơi một nửa số đom đóm đang mang ra xung quanh (nhặt lại được trong 8 giây), và bất tử 1,5 giây.
- Đèn **đã sáng** tạo vùng an toàn bán kính 6 m mà Bóng Mực không vào được.
- Rơi khỏi đảo: mất 1 Ngọn Lửa và toàn bộ đom đóm, sau 1 giây hồi sinh ở điểm xuất phát.
- Gió Lạc (Đêm 2–3) cướp tối đa 3 đom đóm khi Mây mang từ 5 con trở lên; Tỏa Sáng đuổi được nó đi, hoặc bắt nó thả lại đồ đã cướp.
- Bùa Gió: chạy 7,2 m/s và lướt không cần chờ hồi chiêu trong 10 giây.
- **Thắng:** thắp mọi đèn của đêm. **Thua:** hết 3 Ngọn Lửa, hoặc hết giờ (300 / 330 / 360 giây).

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn | +10 |
| Thắp một đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi con, mỗi lần) | +5 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm là tổng điểm các đêm đã thắng.

## Test Contract v1.1

[game.contract.json](game.contract.json) khai báo các con số lấy từ [src/sim/config.js](src/sim/config.js); có test kiểm tra hai nơi khớp nhau. Spec, tiêu chí nghiệm thu và giả định: [docs/notes/phase-2.md](docs/notes/phase-2.md) (Phase 1: [phase-1.md](docs/notes/phase-1.md)).

## Kiểm chứng

| Lệnh | Kết quả |
|---|---|
| `npm test` | 42 test headless: luật Phase 1 với số chuẩn, và ít nhất một scenario cho mỗi tính năng mới |
| `npm run proof` | Báo cáo test, chạy các scenario mẫu cho cả 3 đêm, kiểm tra tất định và thời gian chạy một đêm đầy đủ → [docs/proof/phase-2/](docs/proof/phase-2/README.md) |
| `GPU=1 node scripts/browser-proof.mjs` | Chrome headless: ảnh chụp menu, 3 đêm, màn tạm dừng; FPS ở 1280×720; lỗi console |

CI trên GitHub Actions chạy `npm test` (Node 18 và 22) sau mỗi lần push.

## Harness AI

[AGENTS.md](AGENTS.md) (được [CLAUDE.md](CLAUDE.md) nạp vào), skill [.claude/skills/verify-phase](.claude/skills/verify-phase/SKILL.md), và một Stop hook trong [.claude/settings.json](.claude/settings.json) chặn agent kết thúc khi `npm test` đang đỏ.

## Sáng tạo của tôi

Mọi phần thêm đều nằm trong `src/client/` (chỉ phần hiển thị). Chúng không ảnh hưởng chế độ headless: `src/sim` không import gì từ client, và 42 test cùng phép kiểm tra tất định vẫn đạt (xem [docs/proof/phase-2](docs/proof/phase-2/README.md)).

- **Ông Đăng** kể chuyện ở màn giới thiệu mỗi đêm, và có màn Bình Minh với tiếng chuông khi thắng Đêm 3.
- **Minimap** tròn hiện đèn, đom đóm, Bóng Mực, Gió Lạc và Bùa Gió; mũi tên chỉ tới đèn gần nhất kèm khoảng cách.
- **Hệ hạt:** tia sáng khi thắp đèn, lấp lánh khi nhặt, vệt khi lướt, sóng sáng khi Tỏa Sáng, bụi khi đáp đất; bầu trời sao và mặt trăng; đom đóm trang trí bay nhiều dần khi đảo sáng lên.
- **Model và chuyển động:** Mây có dáng đi, khăn bay, đèn lồng đung đưa; Bóng Mực có đuôi mực và chớp mắt; cây chắn camera tự mờ đi.
- **Âm thanh tự tạo bằng Web Audio:** bước chân, nhảy, đáp đất, lướt, bục gió, chuông, đếm ngược, gió; kèm nhạc nền và nhạc thắng/thua trong `nhac/`.

## Nhạc

Ba file trong [nhac/](nhac/README.md) (`maintheme.mp3`, `win.mp3`, `dead.mp3`) do tác giả repo tự làm/tạo bằng AI (xem [CREDITS.md](CREDITS.md)). Nhạc chỉ có ở bản web, không ảnh hưởng chế độ headless.
