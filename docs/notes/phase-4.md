# Phase 4 (Ticket-04 "Bình minh: phát hành v1.0.0"): giả định, số đo, nhật ký AI

## Acceptance criteria → bằng chứng

| Mục | Kiểm chứng |
|---|---|
| §1 Bench | `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` → [bench.json](../../bench.json); test `bench scene…` (200/100/L1–L3, không sinh thêm, không kết thúc đêm, dầu không đổi), `bench statistics…` (công thức avg, p1-low, p95) |
| §2 Soak | `soak_cmd` → [soak.json](../../soak.json); test `soak: 10 nights…` (0 crash, RSS ≤ 1,2×, kết quả tất định) |
| §3 Bảng xếp hạng | Test: luật tên, thứ tự, top 10, ISO có múi giờ, export, API lưu trên đĩa và còn sau khi khởi động lại server |
| §4 Accessibility | Ảnh `docs/proof/phase-4/screens/07-settings.png` (đổi phím), `03-night1.png` (phụ đề và mũi tên khi Bóng Mực xuất hiện); kiểm tra tay: phím trùng, khôi phục mặc định, giảm chuyển động, chữ lớn |
| §5 Đóng gói | README (3 lệnh), CHANGELOG 4 phase, CREDITS, LICENSE; Release v1.0.0 (bản web tĩnh dạng zip) |
| §6 Contract v1.3 | Test `contract v1.3…`; `bench_cmd`, `soak_cmd` trong `game.contract.json` |

## Giả định

| # | Giả định |
|---|---|
| D1 | Bench là bản web: dùng Chrome hoặc Edge mở chế độ `--app` (cửa sổ, không toàn màn hình). Canvas cố định 1280×720, pixel ratio 1. Vsync tắt bằng `--disable-gpu-vsync --disable-frame-rate-limit`; trình duyệt không cho kiểm tra lại cờ này nên `vsync_off: true` là theo cờ đã truyền. |
| D2 | `load_ms` tính từ lúc tiến trình `bench.mjs` bắt đầu (gồm cả khởi động server và trình duyệt) tới khung hình đầu tiên của cảnh bench (`performance.timeOrigin + timestamp`). |
| D3 | `peak_mem_mb` là tổng RSS của mọi tiến trình trình duyệt dùng profile tạm của lần chạy (Windows: `Win32_Process.WorkingSetSize`; macOS/Linux: `ps rss`), lấy mẫu mỗi giây. Có ghi thêm `js_heap_peak_mb` để tham khảo. |
| D4 | Cảnh bench tắt mọi phần sáng tạo (cây, nhà, đá, hoa, đom đóm trang trí, hạt) nhưng giữ địa hình, đèn và ánh sáng chuẩn. Bóng Mực vẫn theo luật wander (và chase khi tới gần Mây), nhưng không gây sát thương. |
| D5 | Soak: `mem_start_mb` đo sau khi tạo xong Đêm 1 (đã gọi GC); `mem_end_mb` đo sau khi bỏ Đêm cuối (đã gọi GC). Hướng di chuyển mỗi 30 tick là một góc ngẫu nhiên đều, độ dài 1. Nút chỉ "bấm" được khi tick trước đó nhả (đúng mô hình cạnh false → true của contract). |
| D6 | Bảng xếp hạng: `seed` là seed của lượt chơi (đêm n dùng seed + n); `nights_won` là số đêm đã thắng trong lượt. Tên theo NFC; chấp nhận cả chữ Việt có dấu. |

## Số đo bộ nhớ trong soak

| Thử | Kết quả |
|---|---|
| 10 đêm, không có cờ semi-space | RSS ×1,18 (sát ngưỡng 1,2) |
| `heapUsed` sau GC qua 30 đêm | Đứng yên khoảng 4,5 MB, nên **không rò rỉ**. RSS tăng do V8 nới heap (`heapTotal` 9 → 14 MB) và mã JIT |
| Bỏ việc sao chép và sắp xếp lại danh sách đèn mỗi tick | RSS ổn định khoảng ×1,17–1,18 kể cả khi chạy 60 đêm |
| Thêm `--max-semi-space-size=1` (cờ chính thức của `soak_cmd`) | RSS ×1,13 cho 10 đêm |

## Nhật ký dùng AI

| Việc | Ghi chú |
|---|---|
| Bench, soak, bảng xếp hạng, accessibility, đóng gói | Claude Code (Opus). 66/66 test. |
| Lỗi AI #1 | Test bảng xếp hạng kỳ vọng mục cuối có 103 điểm; tính lại đúng là 105 (top 10 gồm 900, 500, 500, rồi 111…105). Lỗi nằm ở test, không phải ở code. |
| Lỗi AI #2 | Soak lần đầu cho RSS ×1,19, chỉ vừa lọt ngưỡng. Thay vì nới cách đo, mình đo `heapUsed` để chứng minh không rò rỉ, rồi giảm rác bộ nhớ ở chỗ chạy nhiều nhất. |
| Yêu cầu của người dùng | Đảo sinh động hơn, video menu tự quay, khôi phục `maintheme.mp3` làm nhạc menu. Đề xuất multiplayer và boss bị **hoãn**, có lý do: tốn quá nhiều thời gian, rủi ro phá yêu cầu tất định, và rubric không cộng điểm cho độ phức tạp. |
