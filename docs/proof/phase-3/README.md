# Bằng chứng Phase 3

Tạo lại: `npm run proof -- 3` và `GPU=1 node scripts/browser-proof.mjs docs/proof/phase-3/screens`.

| Yêu cầu Ticket-03 | Bằng chứng | Kết quả |
|---|---|---|
| Luật dầu, thắp lại, châm dầu, hút dầu, thắng ở bình minh, sức chứa, điểm (contract v1.2) | [test-report.txt](test-report.txt): 58/58 test đạt (16 test mới trong `tests/fuel.test.mjs`) | Đạt |
| Thắng ở bình minh, điểm thưởng | [runs/n1-dawn-survived.jsonl](runs/n1-dawn-survived.jsonl): thắng ở tick 300, 435 = 145 + 85 + 55 + 150 | Đạt |
| Hút dầu tới tắt | [runs/n1-drain-to-out.jsonl](runs/n1-drain-to-out.jsonl): `fuel_drain` ở tick 181/241/301, `lantern_out` ở tick 301 | Đạt |
| Thắp lại và châm dầu | [runs/n1-relight-refuel.jsonl](runs/n1-relight-refuel.jsonl): 100 điểm = 25 + 40 + 35 | Đạt |
| Không thắng sớm | [runs/n1-light-last-no-early-win.jsonl](runs/n1-light-last-no-early-win.jsonl): thắp đủ đèn mà đêm không kết thúc | Đạt |
| Test Phase 1–2 không bị thay thế vẫn đạt; test bị thay thế được ghi lại | [phase-3.md](../../notes/phase-3.md), mục "Test cũ bị luật mới làm sai" | Đạt |
| ADR và changelog | [ADR 0001](../../adr/0001-lantern-fuel-and-dawn-win.md), [CHANGELOG.md](../../../CHANGELOG.md) | Đạt |
| Tính tất định, một đêm chạy dưới 30 giây | [headless-summary.txt](headless-summary.txt): IDENTICAL ×3, khoảng 0,3–0,6 giây mỗi đêm | Đạt |
| Thanh dầu, HUD "Giữ sáng k/n", menu có demo, 60 FPS ở mức giới hạn 60 | [screens/](screens/), [screens/console.txt](screens/console.txt) | Đạt (kiểm tra hiển thị) |
| Chế độ mù màu, nhấp nháy 1 Hz | Kiểm tra bằng tay trong Cài đặt | Đạt (thủ công) |
