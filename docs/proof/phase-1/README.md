# Bằng chứng Phase 1

Tạo lại toàn bộ bằng chứng: `npm run proof` (headless) và `node scripts/browser-proof.mjs` (ảnh chụp).

| Yêu cầu PRD-0 / Contract | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Nhặt đom đóm, nạp đèn, thắp đèn | Scenario `collect-and-light` và các test pickup/deposit | [headless-summary.txt](headless-summary.txt), [runs/collect-and-light.jsonl](runs/collect-and-light.jsonl) | Đạt |
| Thắng khi thắp hết đèn, có điểm thưởng | Scenario `win-last-lantern` (điểm 369 = 100 + 119 + 150) | [runs/win-last-lantern.jsonl](runs/win-last-lantern.jsonl) | Đạt |
| Bóng Mực đuổi, chạm thì mất lửa, thua khi hết lửa | Scenario `shade-hit-lose` và test shade hit | [runs/shade-hit-lose.jsonl](runs/shade-hit-lose.jsonl) | Đạt |
| Tỏa sáng: làm choáng, đẩy lùi, tốn ánh sáng, có hồi chiêu | Scenario `pulse-stun` và các test pulse/stun | [runs/pulse-stun.jsonl](runs/pulse-stun.jsonl) | Đạt |
| Bóng Mực không vào `safe_radius` | Test "shades cannot enter safe_radius" | [test-report.txt](test-report.txt) | Đạt |
| Thua khi hết giờ (bình minh) | Test "dawn" | [test-report.txt](test-report.txt) | Đạt |
| Định dạng JSONL, mô hình tick, mã thoát 2 | Các test format, tick model, bad inputs | [test-report.txt](test-report.txt) | Đạt |
| Tính tất định | Chạy trọn một đêm với seed 42 hai lần rồi so sánh từng byte; thêm một test | [headless-summary.txt](headless-summary.txt) | Đạt |
| Game 3D chơi được, HUD, Mây đội nón lá có đèn | Chrome headless: chụp màn hình tiêu đề, lúc bắt đầu, sau khi đi; 0 lỗi console | [screens/](screens/) | Đạt (chỉ kiểm tra hiển thị) |
| Chơi trọn từ đầu tới thắng/thua bằng tay | Người chơi thật | *chưa ghi lại* | Cần bổ sung clip hoặc ảnh |
