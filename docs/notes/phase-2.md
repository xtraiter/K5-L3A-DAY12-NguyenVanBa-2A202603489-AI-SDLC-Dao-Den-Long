# Phase 2 (Ticket-02 "Ba hòn đảo"): spec, acceptance criteria, giả định, nhật ký AI

Nguồn yêu cầu: Ticket-02 trên lab board. Contract v1.1.

## Kiến trúc

Không đổi so với Phase 1. Toàn bộ luật nằm trong `src/sim/`, chạy được không cần DOM, tất định theo seed.

| File | Vai trò |
|---|---|
| `src/sim/config.js` | `TUNING` (khóa contract), `RULES` (số chuẩn khác và giả định) |
| `src/sim/maps.js` | 3 bản đồ chuẩn: đèn, điểm sinh đom đóm và Bóng Mực, bục nhảy, hàm `ground(x, z)` cho độ cao mặt đất (`null` = biển mây) |
| `src/sim/sim.js` | Hàm xử lý một tick theo đúng 12 bước của ticket (có chú thích từng bước) |
| `src/client/` | Menu, giới thiệu Đêm, HUD, tạm dừng, cài đặt, âm thanh, dựng 3D. Không chứa luật chơi |

## Acceptance criteria (mỗi mục ở Phần 3 có ít nhất một test headless)

| Mục | Tiêu chí kiểm tra được | Test / scenario |
|---|---|---|
| Số liệu chuẩn | `game.contract.json` v1.1 khớp `TUNING`; tốc độ 6 m/s; nhảy 7 m/s, trọng lực 20 | `contract v1.1`, `movement`, `jump` |
| Lướt | 14 m/s trong 12 tick; hồi chiêu 90 tick tính từ lúc bắt đầu; đứng yên thì lướt theo hướng mặt; trên không giữ nguyên độ cao | `dash: 14 m/s…`, `dash in the air keeps altitude` |
| Đom đóm | Sinh 20 con, cứ 240 tick thêm 1 con ở điểm trống; nhặt khi XZ ≤ 1 và chênh cao ≤ 1,5; sức chứa 10 | `random motes…`, `pickup…` |
| Đèn | Chi phí 10; tương tác trong 2 m; chọn đèn chưa sáng gần nhất, bằng nhau thì id nhỏ hơn; +10 điểm mỗi đom đóm nạp, +100 khi thắp | `deposit…`, `interact…` |
| Vùng an toàn | Chỉ đèn đã sáng mới chặn Bóng Mực ở mép 6 m; Bóng Mực đang ở trong bị đẩy ra trong ≤ 30 tick và không gây sát thương | `safe zone: only LIT…`, `…newly lit lantern…` |
| Tỏa Sáng | Tốn 3; bán kính 3D 5 m tính từ chân + 0,8 m; choáng 120 tick; đẩy 4 m trong 15 tick; hồi chiêu 3 s; +5 điểm mỗi con | `pulse…`, `stun lasts 120 ticks…` |
| Bóng Mực | Sinh 2 con ở tick 300, sau đó mỗi 480/420/360 tick; cách người chơi ≥ 15 m; tối đa 6/8/10; trạng thái spawning, wander, chase (12 m), wander (bỏ đuổi > 18 m), recoil, stunned | `shade schedule…`, `shade states…`, `spawning shades…` |
| Bị đánh | −1 Ngọn Lửa; rơi floor(mang/2) đom đóm ra vành 1,5–2,5 m (TTL 480 tick); bất tử 90 tick; Bóng Mực lùi lại (recoil) | `shade hit…`, `dropped motes expire…` |
| Rơi khỏi đảo | Chỉ tính một lần; −1 Ngọn Lửa, mất toàn bộ đom đóm, chờ 60 tick rồi hồi sinh ở điểm xuất phát, bất tử; hết Ngọn Lửa thì thua ngay | `fall off the island…`, `falling with the last flame…` |
| Đêm 2 | 6 đèn; cầu đi được, khoảng trống thì rơi; bục nhảy bay khoảng 1,4 s sang đảo kia | `night 2 map…`, `night 2 launch pad…` |
| Đêm 3 | Dốc 30° dẫn lên tầng 1 (Y = 3); mép tầng 2 là vách; bục (0,3,13) đưa lên tầng 2 | `night 3: ramp…`, `night 3 launch pad…` |
| Gió mạnh | Đêm 3: cứ 1800 tick có một cơn gió 300 tick, đẩy 2 m/s; các đêm khác không có gió | `night 3 wind…` |
| Gió Lạc | Đuổi khi Mây mang ≥ 5 và cách ≤ 15 m; cướp min(3, đang mang); flee 240 tick rồi biến mất; Tỏa Sáng lúc đang chase thì nó flee mà không cướp; Tỏa Sáng lúc đang flee có đồ thì nó thả lại đồ và biến mất sau 120 tick; bất tử không chặn bị cướp; sinh từ tick 1200 ở Đêm 2–3 | 5 test `drifter…` |
| Bùa Gió | Có sự kiện `charm_picked`; tốc độ 7,2 m/s; lướt không hồi chiêu; xuất hiện lại sau 2700 tick; vị trí mặc định đúng | `wind charm…`, `default charms…` |
| Tạm dừng | `tick` vẫn tăng, `sim_tick` và thời gian đứng yên, `state = paused`; có sự kiện `paused`/`resumed` | `pause…` |
| Hiệu năng | Chạy trọn một đêm (21.600 tick) dưới 30 s | `a full night…` + `headless-summary.txt` (khoảng 0,2 s) |
| Chuỗi 3 Đêm, menu, cài đặt, HUD, âm thanh, bảng màu | Kiểm tra trên trình duyệt: ảnh chụp cả 3 đêm, màn tạm dừng, 0 lỗi console, ≥ 30 FPS ở 1280×720 | `scripts/browser-proof.mjs` → `docs/proof/phase-2/screens/` |

## Giả định (chỗ Ticket-02 chưa nói rõ)

| # | Chủ đề | Giả định |
|---|---|---|
| B1 | Tăng tốc ≤ 0,1 s | Đạt tốc độ tức thì (0 s vẫn thỏa ≤ 0,1 s), giữ đúng quãng đường mà test Phase 1 kỳ vọng. |
| B2 | Thời gian ở trạng thái `spawning` | 60 tick. Trong lúc này Bóng Mực đứng yên và không gây sát thương, nhưng vẫn bị Tỏa Sáng trúng. |
| B3 | `wander` | Đi 1,5 m/s tới một điểm ngẫu nhiên trong bán kính 8 m quanh điểm sinh. |
| B4 | Độ cao Bóng Mực | Tâm cao hơn mặt đất 1 m với con tự sinh. Con đặt trong scenario thì giữ độ cao tương đối mà scenario cho. Bóng Mực không leo được vách và không đi trên biển mây. |
| B5 | Vách và dốc | Bước lên được nếu chênh lệch ≤ 0,35 m mỗi tick (đủ cho dốc), cao hơn thì coi là vách. Đi ra khỏi mép thì rơi xuống tầng dưới. |
| B6 | Đêm 3 xuất phát | (0, 0, −30), quay mặt về +Z, vì (0,0,0) nằm trong tháp chuông. Đêm 2 xuất phát ở (0,0,0). |
| B7 | Gió | Cơn gió bắt đầu ở sim tick 1800·k (k ≥ 1). Hướng lấy từ seed. Góc tính từ +X về +Z, giống quy ước góc của bản đồ. |
| B8 | Gió Lạc | Bay, không bị địa hình chặn, cao hơn mặt đất 1,5 m; lúc idle lượn giữa các điểm sương. Con đã `removed` vẫn nằm trong snapshot với trạng thái `removed`. |
| B9 | `invuln` trong snapshot | Kiểu boolean, vì tên không có hậu tố `_s` như các trường khác. |
| B10 | `night_start` | Ghi ở tick 0, ngay sau snapshot tick 0. |
| B11 | Đếm đom đóm cho trần 30 | Chỉ đếm đom đóm loại `random`; đom đóm rơi là tạm thời nên không tính. |
| B12 | Interact | Khoảng cách theo XZ (đúng quy ước contract v1.0), không xét chênh cao. |
| B13 | Pause | Khi đang tạm dừng, cạnh nút bấm vẫn được ghi nhận (không dồn lại để kích hoạt sau). |

## Test thay đổi so với Phase 1 (do yêu cầu đổi, có lý do)

| Test Phase 1 | Thay đổi | Lý do (Ticket-02) |
|---|---|---|
| safe zone quanh mọi đèn, 5 m | Chỉ đèn đã sáng, 6 m; thêm test đẩy Bóng Mực ra | Phần 1 "Vùng an toàn" |
| pulse: tốn 1, bán kính 6 m XZ, đẩy tức thì | Tốn 3, bán kính 3D 5 m, đẩy 4 m trong 15 tick, choáng 120 tick | Phần 1 "Tỏa Sáng" |
| nhặt đom đóm được +10 | Được +10 cho mỗi đom đóm **nạp vào đèn** | Phần 1 "Điểm" |
| đom đóm rơi mất luôn | Rơi ra vành 1,5–2,5 m, tồn tại 480 tick | Phần 1 "Bị đánh" |
| Bóng Mực ngẫu nhiên sinh ngay từ đầu | Sinh theo lịch ở tick 300 với trạng thái `spawning` | Phần 1 "Lịch sinh" |
| `events[0]` là sự kiện đầu tiên | Bỏ qua `night_start` ở tick 0 khi so sánh | Contract v1.1 thêm `night_start` |
| Giới hạn thời gian thắng (×1) | ×2 mỗi giây còn lại | Phần 1 "Điểm" |

## Nhật ký dùng AI

| Việc | Ghi chú |
|---|---|
| Chuẩn hóa sim, 3 bản đồ, contract v1.1 | Claude Code (Opus). Viết lại `sim.js` theo đúng 12 bước của ticket rồi viết 42 test. Lần chạy đầu 41/42 đạt. |
| Lỗi AI #1 | Test gió: dùng helper `quiet()` vốn tắt gió (`wind_enabled: false`) nên test đỏ. Lỗi nằm ở test, không phải ở game; đã sửa test. |
| Lỗi AI #2 | Dùng `node -e` trong bash để chèn code có template literal; bash nuốt mất `${…}` và backtick (hai lần). Phát hiện nhờ lỗi cú pháp và nhờ đọc lại diff. Bài học (đã ghi vào AGENTS.md): sửa code bằng công cụ Edit/Write, không chèn code qua shell. |
| Lỗi AI #3 | Đo FPS bằng Chrome headless chế độ SwiftShader chỉ được 8–12 FPS. Đó là vẽ bằng phần mềm (CPU), không phải lỗi game; đo lại với GPU được 63–66 FPS. Ghi rõ cả hai số trong bằng chứng. |
| Client | Viết lại client: menu, lời Ông Đăng, kết quả, màn Bình Minh, pause, cài đặt (localStorage), HUD đầy đủ kèm minimap, hệ hạt, model mới, âm thanh tạo bằng Web Audio. Ba file nhạc do người dùng tự làm/AI tạo. |

Token và chi phí ước tính: *(điền từ `/cost` khi tag)*.
