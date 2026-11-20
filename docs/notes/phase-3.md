# Phase 3 (Ticket-03 "Đèn cạn dầu", Change Request): giả định, test thay đổi, nhật ký AI

- Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md) (mô hình trạng thái đèn, luật thắng).
- Breaking changes: [CHANGELOG.md](../../CHANGELOG.md).
- Test mới: `tests/fuel.test.mjs` (16 test). Tổng cộng 58 test đạt.

## Acceptance criteria → test

| Mục Ticket-03 | Test |
|---|---|
| §1 hao 1/s, chính xác; đèn tắt khi ≤ 0, `lantern_out`, `deposited = 0`, `ever_lit` giữ nguyên | `fuel decays…`, `lantern goes out…` |
| §1 thắp lại tốn 5, +40, `relit_count`; thắp lần đầu tốn 10, +100 | `relight…`, `first light…` |
| §1 châm dầu `used = min(mang, ceil((100−fuel)/10))`, tối đa 100 | `refuel…` |
| §1 chọn đèn nhận được, gần nhất | `interact picks…` |
| §2 dầu < 30 mất vùng an toàn | `a lantern below 30…` |
| §2 wander → đèn yếu → drain 5/s, `fuel_drain` mỗi 60 tick, đèn tắt → wander | `wander shade goes…` |
| §2 drain → chase (Mây trong 6 m) | `drain -> chase…` |
| §2 châm lên ≥ 30 → Bóng Mực thôi hút, bị đẩy ra, không gây sát thương | `refuel to >= 30…` |
| §5 Tỏa Sáng trúng con đang drain +15 | `pulse on a draining shade…` |
| §3 thắng ở bình minh với ≥ ceil(0.6n) đèn sáng; ngưỡng 3/5, 4/6, 5/7; `no_flames` ưu tiên ở tick bình minh | `dawn win…`, `dawn thresholds…`, `losing the last flame on the dawn tick…` |
| §3 không thắng sớm | `lighting every lantern does not end the night early` |
| §4 sức chứa 10 + 2×lần thắp, tối đa 20 | `capacity…`, `relight…` (capacity 12) |
| §7 contract v1.2: tuning, snapshot, scenario | `contract v1.2…`, `output format…`, `scenario v1.2 fields…` |
| §6 chế độ mù màu, thanh dầu, nhấp nháy 1 Hz, đèn tắt xẹp và rách | Kiểm tra trên trình duyệt: `docs/proof/phase-3/screens` |

## Test cũ bị luật mới làm sai (đã sửa hoặc thay, không skip)

| Test | Thay đổi | Lý do |
|---|---|---|
| `contract v1.1…` | Đổi thành `contract v1.2…`, kiểm tra thêm thời lượng 240/270/300 | §7 |
| `output format…` | Thời gian còn lại tính từ 240 (không phải 300); đèn có thêm `fuel`, `ever_lit`, `relit_count`; player có thêm `capacity` | §3, §7 |
| `deposit…` | +5 mỗi đom đóm (trước là +10); `lantern_lit` có thêm `relight: false` | §5, §7 |
| `win: last lantern lit => won…` | **Xóa và thay** bằng `lighting every lantern does not end the night early` | §3: bỏ thắng sớm và `all_lit` |
| `pause…` (features) | Thời gian còn lại tính từ 240 | §3 |
| `shade states…` (features) | Ngưỡng khoảng cách nới đúng bằng một bước wander (1,5/60 m) | Wander giờ đi về đèn tắt gần nhất (§2), nên trong tick bỏ đuổi, Bóng Mực có thể nhích lại gần Mây thêm tối đa một bước |

## Giả định (chỗ Ticket-03 chưa nói rõ)

| # | Giả định |
|---|---|
| C1 | Wander mà không có đèn yếu thì đi 1,5 m/s về đèn tắt gần nhất và đứng chờ trong 3 m quanh đèn. Nếu không còn đèn tắt thì lượn quanh điểm sinh như Phase 2. Đi tới đèn yếu dùng tốc độ Bóng Mực (4 / 4,5 m/s). |
| C2 | Bóng Mực wander vẫn chuyển sang chase khi Mây trong 12 m (luật Phase 2), kể cả khi đang đi tới đèn yếu. Riêng trạng thái drain thì chỉ chuyển sang chase khi Mây trong 6 m. |
| C3 | `fuel_drain` được ghi sau mỗi 60 tick hút liên tục của từng con (bộ đếm đặt lại khi vào drain); `fuel` trong sự kiện là giá trị sau khi trừ ở tick đó. |
| C4 | Đẩy ra khi châm dầu chỉ áp dụng khi dầu vượt ngưỡng 30 (từ < 30 lên ≥ 30). Nếu dầu đã ≥ 30 từ trước thì vùng an toàn vốn đã chặn Bóng Mực. |
| C5 | Đèn đặt sẵn bằng scenario với `lit: true` mà không có `ever_lit` thì coi như `ever_lit: true`; nếu thiếu `fuel` thì fuel = 100 (đúng §7). |
| C6 | Khóa điểm mới được thêm vào `tuning.score`: `per_relight`, `per_stun_drain`, `per_lit_lantern_at_dawn`; `per_second_left` = 0 vì thưởng thời gian đã bị bỏ. |

## Client (Phase 3 và yêu cầu thêm của người dùng)

- Thanh dầu trên đèn, quay về phía camera; dầu < 30 thì đèn và thanh dầu nhấp nháy 1 Hz. Đèn tắt bị xẹp 20% và có vết rách giấy, nên phân biệt được mà không cần dựa vào màu.
- Chế độ "Bảng màu dễ phân biệt" (được lưu): viền và mắt Bóng Mực đổi sang #00B3FF, màu cảnh báo đổi sang #FFFFFF kèm ⚠.
- HUD: "Giữ sáng k/n tới bình minh", đèn nhỏ trên HUD có ba trạng thái (sáng / sắp hết / đã tắt), "Đom đóm x/sức chứa", gợi ý `E — Châm dầu / Thắp lại / Nạp ánh sáng`.
- Yêu cầu thêm của người dùng: hỗ trợ mọi tỷ lệ màn hình (FOV dọc tự tăng trên màn hình hẹp hoặc dọc, HUD có bố cục riêng cho màn hình dọc và màn hình thấp); cài đặt giới hạn FPS (30/60/120/144/không giới hạn), hiện FPS, độ phân giải 50–100%; menu có demo trực tiếp (bot chơi phía sau menu) hoặc video `video/menu.mp4` nếu có.

## Nhật ký dùng AI

| Việc | Ghi chú |
|---|---|
| Sim, contract v1.2 | Claude Code (Opus). Dầu lưu bằng số nguyên đơn vị 1/60 (theo gợi ý của ticket). Lần chạy đầu 6 test cũ đỏ, đúng như dự đoán từ luật mới; 1 test đỏ ngoài dự đoán (`shade states`) do thay đổi hành vi wander. Bộ test mới đạt 58/58 ngay lần đầu. |
| Lỗi AI #1 | Bộ giới hạn FPS ban đầu (bỏ khung nếu chưa đủ 1000/cap ms) làm FPS rớt từ 66 xuống 33 trên màn hình 66 Hz. Phát hiện nhờ số đo trong `console.txt`; sửa bằng cách tích lũy ngân sách thời gian qua các khung, đo lại được 60,0 FPS. |
| Lỗi AI #2 | Đặt tham số `now` trùng tên với `const now` trong cùng hàm (lỗi cú pháp). Phát hiện khi đọc lại code trước khi chạy. |
