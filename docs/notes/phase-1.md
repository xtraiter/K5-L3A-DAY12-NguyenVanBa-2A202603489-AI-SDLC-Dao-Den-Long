# Phase 1: kế hoạch, giả định, nhật ký AI

## Kế hoạch

1. Đọc Test Contract trước để chốt kiến trúc: tách logic thuần (`src/sim`) khỏi phần hiển thị (`src/client`, Three.js).
   Chế độ headless dùng chính `Sim` đó nên không thể lệch luật với bản chơi.
2. Viết `Sim` theo đúng mô hình tick, rồi viết test headless cho từng điều khoản của contract
   (khoảng cách tính trên mặt phẳng XZ với ≤, tick của sự kiện, snapshot ở tick 0, cạnh nút bấm, mã thoát 2, tính tất định).
3. Làm client web: đảo, đèn, đom đóm, Bóng Mực, Mây (nón lá và đèn nhỏ), HUD, màn thắng/thua, chơi lại.
4. Lưu bằng chứng: `npm run proof` cho headless, `scripts/browser-proof.mjs` cho ảnh chụp và lỗi console.
5. Harness: AGENTS.md, Stop hook chặn kết thúc khi test đỏ, skill verify-phase, CI.

Lý do chọn công nghệ: dùng JS thuần, Node chạy headless và có server tĩnh tự viết, nên không cần cài dependency.
Repo nằm trên Google Drive, nên tránh được việc đồng bộ hàng nghìn file `node_modules`.
Giảng viên dùng macOS/Linux chỉ cần có Node.

## Giả định (chỗ PRD-0 còn mơ hồ)

| # | Chủ đề | Giả định |
|---|---|---|
| A1 | "Ánh sáng" để tỏa sáng | Mỗi lần tỏa sáng tốn `pulse_cost` = 1 đom đóm đang mang. Mang ít hơn mức đó thì không tỏa sáng được và không có sự kiện. |
| A2 | Tỏa sáng khi đang hồi chiêu | Không có tác dụng, không có sự kiện. Nếu không có Bóng Mực nào trong bán kính thì vẫn tốn ánh sáng và vẫn có sự kiện `pulse` với `stunned_ids: []`. |
| A3 | Đẩy lùi | Bóng Mực bị đẩy `pulse_push_m` mét ra xa người chơi theo mặt phẳng XZ. Nếu trùng vị trí thì đẩy theo +X. |
| A4 | Điểm `per_stun` | Tính cho mỗi Bóng Mực có trong `stunned_ids`. |
| A5 | `safe_radius` | Áp dụng cho **mọi** Đèn Lồng Lớn, kể cả đèn chưa thắp (PRD: "Bóng Mực sợ những chiếc đèn"). Bóng Mực vào trong vòng sẽ bị đẩy ra mép. |
| A6 | Đánh rơi khi bị chạm | `dropped = floor(carried × 0.5)`. Đom đóm rơi thì mất luôn, không xuất hiện lại trên đất. |
| A7 | Bị chạm | Mỗi tick bị chạm tối đa một lần. Sau đó bất tử `invuln_s`, trong lúc này không có sự kiện `player_hit`. Bóng Mực đang choáng thì không gây sát thương. |
| A8 | Nạp đèn | Bấm E sẽ nạp vào đèn **chưa thắp gần nhất** trong `interact_radius`, với `amount = min(carried, lantern_cost − deposited)`. Nhặt đom đóm là tự động. |
| A9 | Điểm thưởng | Chỉ cộng khi thắng: `floor(time_left_s)` × 1 và số ngọn lửa còn lại × 50. |
| A10 | Rơi khỏi đảo | Không có. Đảo có tường vô hình bán kính 40 m nên `fall_enabled = false`. |
| A11 | Nhảy | Chỉ để hiển thị và né tránh trực quan. Mọi khoảng cách tính trên XZ nên nhảy không né được Bóng Mực. |
| A12 | Sinh ngẫu nhiên | `random_motes`: lúc đầu có 30 đom đóm, cứ 2 giây sinh lại một con nếu đang ít hơn 30. `random_shades`: lúc đầu có 2 con (S1, S2) và không phát sự kiện. Cứ 25 giây sinh thêm một con (có `shade_spawned`), tối đa 6. Bóng Mực xuất hiện trên vòng bán kính 30–38 m. |
| A13 | Thứ tự trong một tick | Đếm giờ → di chuyển và nhảy → nhặt → nạp → tỏa sáng → Bóng Mực di chuyển → sinh thêm → va chạm → bình minh. |
| A14 | Scenario | `lit: true` mà không có `deposited` thì coi như `deposited = lantern_cost`. `lanterns[].id` ngoài L1–L5 thì in cảnh báo ra stderr rồi bỏ qua. Có `motes` hoặc `shades` thì thay thế danh sách ban đầu, còn `random_*` chỉ quyết định có sinh thêm hay không. `time_left_s` thay cho thời lượng đêm. |
| A15 | Input sai | JSON hỏng, tick không tăng nghiêm ngặt, `move` ngoài [−1, 1], nút không phải boolean, hoặc vec3 sai thì thoát với mã 2. Tham số dòng lệnh sai thì thoát với mã 1. |
| A16 | Snapshot | Chỉ ghi ở các tick là bội số của `--snapshot-every`; không thêm snapshot cuối. Trạng thái cuối nằm ở dòng `end`. |

## Nhật ký dùng AI

| Việc | Công cụ | Ghi chú |
|---|---|---|
| Đọc PRD, lên kiến trúc, viết sim, headless, test, client, harness | Claude Code (Opus) | Một phiên. Viết test cho từng điều khoản contract ngay sau khi có sim. |
| Lỗi do AI gây ra | Scenario `pulse-stun` | AI đặt tỏa sáng ở tick 60 trong khi Bóng Mực vẫn ngoài 6 m nên không bị choáng. Phát hiện nhờ đọc `headless-summary.txt` (điểm = 0), sau đó sửa scenario (tỏa sáng ở tick 80). Bài học: luôn đọc output, không chỉ nhìn mã thoát. |

Token và chi phí ước tính: *(điền từ `/cost` hoặc trang usage khi tag)*.

## Retro ngắn

*(điền khi tag phase-1)*
