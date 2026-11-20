# Retro: Đảo Đèn Lồng (4 phase)

## Evaluation từng phase

| Phase | Đạt | Chưa đạt / nợ | Test |
|---|---|---|---|
| 1. PRD-0 | Đêm 1 chơi được, headless v1.0 tất định, proof script, Stop hook, CI | Thiếu clip chơi bằng tay | 17 |
| 2. Ticket-02 | Số chuẩn, 3 bản đồ, 12 bước tick, Gió Lạc, Bùa Gió, gió mạnh, pause, client 3 đêm; 63–66 FPS | Âm thanh và cài đặt chỉ kiểm tra bằng tay | 42 |
| 3. Ticket-03 | Dầu đèn bằng số nguyên, drain, thắng ở bình minh, ADR, CHANGELOG; mù màu, nhiều tỷ lệ màn hình, giới hạn FPS | Nhấp nháy 1 Hz và mù màu kiểm tra bằng tay | 58 |
| 4. Ticket-04 | Bench (99 FPS / p1 56 / 0,9 s), soak (0 crash, ×1,13), bảng xếp hạng, accessibility, đóng gói | Bench chỉ đo trên máy dev; Release và video demo cần người dùng tải lên | 66 |

## Điều hiệu quả khi làm với AI

- **Đọc contract trước, kiến trúc sau.** Tách `src/sim` thuần (không DOM, không `Math.random`) ngay từ Phase 1, nên headless, soak và bench đều dùng chung một Sim. Mỗi lần ticket đổi luật, chỉ cần sửa ở một chỗ.
- **Test viết theo từng điều khoản contract** (tick k → k+1, ≤ r, cạnh nút bấm, mã thoát 2). Khi Ticket-02 và 03 đổi luật, test đỏ đúng những chỗ dự đoán, nên dễ ghi lý do sửa.
- **Số nguyên cho dầu** (đơn vị 1/60): tất định tuyệt đối, bình minh luôn rơi đúng tick.
- **Bằng chứng tự động:** `npm run proof`, `browser-proof.mjs` (ảnh + FPS + lỗi console), bench và soak đều sinh file. Agent chụp ảnh và đọc lại ảnh nên phát hiện được lỗi giao diện (cây che camera, mũi tên đè đồng hồ, menu bị cắt).

## Điều không hiệu quả

- Chèn code qua `node -e`/heredoc trong bash: shell nuốt mất `${}` và backtick (xảy ra 3 lần). Đã thêm quy tắc vào AGENTS.md: sửa code bằng công cụ Edit/Write.
- Đo FPS bằng SwiftShader (vẽ bằng CPU) cho ra 8–12 FPS, dễ hiểu nhầm là game chậm. Đã ghi vào AGENTS.md: đo với `GPU=1`.
- Phạm vi phình theo yêu cầu thêm giữa phase (giao diện, video, trang trí) làm tốn token. Cách xử lý: luôn commit phần lõi (test ẩn) trước, phần thêm sau.

## Những lần AI sai và cách phát hiện

| Lỗi | Phát hiện bằng | Sửa harness |
|---|---|---|
| Scenario pulse đặt sai tick (Bóng Mực ngoài tầm) | Đọc `headless-summary.txt` thấy điểm = 0 | Skill verify-phase: "đọc output, không chỉ nhìn mã thoát" |
| Test gió dùng helper tắt gió | Test đỏ, đọc lại helper | — |
| Bộ giới hạn FPS làm rớt từ 66 xuống 33 | Số đo trong `console.txt` | Đổi sang tích lũy ngân sách thời gian |
| Trùng tên biến `now` (lỗi cú pháp) | Đọc lại code trước khi chạy | — |
| Kỳ vọng sai trong test bảng xếp hạng (103 thay vì 105) | Test đỏ, tính lại bằng tay | Tách tính toán kỳ vọng ra comment |
| RSS soak sát ngưỡng | Đo `heapUsed` để tách rò rỉ khỏi việc V8 nới heap | Bỏ việc cấp phát trong vòng lặp chính, thêm cờ V8 |

## Harness giúp nhiều nhất

1. **Stop hook chặn kết thúc khi `npm test` đỏ**: không lần nào agent dừng lại khi test còn đỏ.
2. **AGENTS.md ngắn** (lệnh, bố cục, quy tắc contract). Được cập nhật qua 4 phase (lịch sử git).
3. **`browser-proof.mjs`**: ảnh chụp, FPS và lỗi console là "mắt" của agent; nhiều lỗi giao diện chỉ thấy được qua đây.

## Token và chi phí

- Ước tính: *(điền từ `/cost` hoặc trang usage của Claude; agent không tự đọc được số này)*.
- Cách tiết kiệm đã dùng: không dùng subagent hay workflow nhiều agent; đọc file theo đoạn; dùng grep thay vì đọc cả file; một bộ test chạy nhanh (~6 s) thay vì chạy game nhiều lần; proof script sinh bằng chứng một lệnh.

## Nếu làm lại

- Chốt `scripts/` (proof, browser-proof, bench) ngay từ Phase 1 và chạy trong CI.
- Instancing cho Bóng Mực ngay từ đầu (200 Bóng Mực × ~10 mesh là điểm nghẽn của bench trên GPU yếu).
- Giữ yêu cầu thêm giữa phase trong một danh sách chờ, làm sau khi đã tag phase.
