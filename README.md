# Đảo Đèn Lồng

> Video demo: *(thêm ở Phase 4)*

Game 3D góc nhìn thứ ba chạy trên trình duyệt. Bạn điều khiển **Mây**, người giữ đèn nhỏ tuổi đội nón lá. Nhiệm vụ là gom đom đóm và thắp lại 5 Đèn Lồng Lớn của **Đảo Bến** trước bình minh, đồng thời né **Bóng Mực** trong sương đen.

- Engine: Three.js r160 (đã đóng gói sẵn trong `vendor/`). Logic game viết bằng JavaScript thuần trong `src/sim/`, dùng chung cho bản web và chế độ headless.
- Chạy trên macOS, Linux hoặc Windows. Chỉ cần **Node.js ≥ 18**; không có thư viện npm nào phải cài.
- Đề bài lab gốc nằm ở [docs/lab/](docs/lab/README.md).

## Cài đặt và chạy

```bash
npm install        # không có dependency, chỉ kiểm tra môi trường
npm start          # mở http://localhost:8080 trên trình duyệt
npm test           # chạy toàn bộ test
```

Chế độ headless (Test Contract v1.0):

```bash
node src/headless.mjs --seed 1 --night 1 --ticks 3600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D (hoặc ↑ ↓) | Di chuyển theo hướng camera |
| Kéo chuột / ← → | Xoay camera |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn gần nhất (trong 3 m) |
| F | Tỏa sáng: tốn 1 đom đóm, làm choáng và đẩy lùi Bóng Mực trong bán kính 6 m |
| Enter / R | Bắt đầu / chơi lại |

## Luật chơi và cách tính điểm

- Đi gần đom đóm (≤ 1,5 m) là tự nhặt; mang tối đa **5** con.
- Mỗi đèn cần **5** đom đóm. Có thể nạp nhiều lần, mỗi lần nạp tối đa số còn thiếu.
- Bóng Mực đuổi theo Mây với tốc độ 3,5 m/s (Mây chạy 6 m/s). Bị chạm (≤ 1 m) thì mất 1 ngọn lửa, đánh rơi một nửa số đom đóm đang mang (làm tròn xuống, số rơi mất luôn) và được bất tử 2 giây.
- Bóng Mực sợ đèn: chúng không vào được vòng bán kính **5 m** quanh mỗi Đèn Lồng Lớn, kể cả đèn chưa thắp. Vòng này có vẽ trên mặt đất.
- **Thắng:** thắp cả 5 đèn. **Thua:** hết 3 ngọn lửa, hoặc hết 300 giây (bình minh).

| Sự kiện | Điểm |
|---|---|
| Nhặt một đom đóm | +10 |
| Thắp một đèn | +100 |
| Mỗi Bóng Mực bị làm choáng bởi một lần tỏa sáng | +20 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +1 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

Khi thua thì không có điểm thưởng thời gian hay ngọn lửa.

## Test Contract

[game.contract.json](game.contract.json) khai báo các con số lấy từ [src/sim/config.js](src/sim/config.js). Có test kiểm tra hai nơi khớp nhau.

- `fall_enabled: false`: đảo có tường vô hình ở bán kính 40 m nên không thể rơi, vì vậy game không bao giờ phát sự kiện `player_hit` với `by: "fall"`.
- Trạng thái của Bóng Mực trong snapshot là `chase` hoặc `stunned`.
- Mỗi snapshot có thêm mảng `motes` (`id`, `pos`).

Các giả định cho những chỗ PRD còn mơ hồ: [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Kiểm chứng

| Lệnh | Kết quả |
|---|---|
| `npm test` | Test headless theo contract (17 test) |
| `npm run proof` | Ghi báo cáo test, kết quả chạy các scenario mẫu và kiểm tra tất định vào [docs/proof/phase-1/](docs/proof/phase-1/README.md) |
| `node scripts/browser-proof.mjs` | Mở game trong Chrome headless, bấm phím, chụp ảnh, ghi lỗi console |

CI trên GitHub Actions chạy `npm test` sau mỗi lần push.

## Harness AI

[AGENTS.md](AGENTS.md) (được [CLAUDE.md](CLAUDE.md) nạp vào), skill [.claude/skills/verify-phase](.claude/skills/verify-phase/SKILL.md), và một Stop hook trong [.claude/settings.json](.claude/settings.json) chặn agent kết thúc khi `npm test` đang đỏ.

## Sáng tạo của tôi

*(chưa có ở Phase 1)*

## Nhạc

Thả file vào thư mục [nhac/](nhac/README.md) (`bgm.mp3`, `pickup.mp3`…), game tự nạp. File nào thiếu thì bỏ qua. Nhạc chỉ có ở bản web, không ảnh hưởng chế độ headless.
