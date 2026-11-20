# Bằng chứng Phase 2

Tạo lại toàn bộ: `npm run proof` (headless, tất định, tốc độ) và `GPU=1 node scripts/browser-proof.mjs` (ảnh chụp, FPS, lỗi console).

| Yêu cầu Ticket-02 | Bằng chứng | Kết quả |
|---|---|---|
| Số chuẩn và contract v1.1 | [test-report.txt](test-report.txt): 42/42 test, gồm `contract v1.1` | Đạt |
| Test Phase 1 vẫn đúng với số chuẩn | Các test cũ được chạy lại với số chuẩn (17 → 17 test, đã cập nhật kèm lý do trong [phase-2.md](../../notes/phase-2.md)) | Đạt |
| Mỗi tính năng mới có ít nhất 1 scenario headless | `tests/features.test.mjs` (25 test) và `tests/scenarios/n1-*, n2-*, n3-*` → [runs/](runs/), [headless-summary.txt](headless-summary.txt) | Đạt |
| Một đêm đầy đủ chạy ≤ 30 s | [headless-summary.txt](headless-summary.txt): cả 3 đêm khoảng 0,2–0,3 s / 21.600 tick | Đạt |
| Tính tất định | Chạy trọn từng đêm hai lần với seed 42, so sánh từng byte: IDENTICAL ×3 | Đạt |
| ≥ 30 FPS ở 1280×720 | [screens/console.txt](screens/console.txt): GPU 63–66 FPS (Chrome headless, cửa sổ 1280×720). Chế độ SwiftShader không dùng GPU chỉ được 8–12 FPS, không đại diện cho máy thật | Đạt (đo trên máy dev, có GPU) |
| Menu, giới thiệu Đêm, HUD, tạm dừng | [screens/](screens/): 01-menu, 02-intro, 03…05 ba đêm, 06-pause; 0 lỗi console | Đạt (kiểm tra hiển thị) |
| Âm thanh, cài đặt được lưu | Kiểm tra bằng tay trên trình duyệt (âm lượng và độ nhạy lưu bằng localStorage) | Đạt (thủ công, chưa có test tự động) |
| Chơi trọn 3 đêm từ đầu tới màn Bình Minh | *chưa ghi lại* | Cần quay clip |
