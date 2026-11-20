# Changelog

## [phase-3] Ticket-03 "Đèn cạn dầu" (contract v1.2)

### Breaking changes
- `contract_version` đổi `1.1` → `1.2`. Thời lượng các đêm 300/330/360 → **240/270/300 s**.
- **Không còn thắng sớm.** Lý do kết thúc `all_lit` bị bỏ. Thắng = còn sống ở bình minh với ≥ ceil(0.6 × tổng đèn) đèn đang sáng (`dawn_survived`). Thua: `dawn` hoặc `no_flames`.
- Đèn có thể **tắt**: dầu hao 1/s; hết dầu thì `lit=false`, `deposited=0`, phát `lantern_out`. Thắp lại đèn đã từng sáng tốn 5 đom đóm.
- **Vùng an toàn** chỉ có khi đèn sáng và fuel ≥ 30 (trước đây: mọi đèn đã sáng).
- **Điểm**: +5 mỗi đom đóm nạp (trước: +10); thắp lần đầu +100, thắp lại +40; Tỏa Sáng +5 mỗi con (+15 nếu con đó đang `drain`); thưởng bình minh: mỗi đèn sáng +50 + floor(fuel), mỗi Ngọn Lửa +50; **bỏ thưởng thời gian** (`per_second_left` = 0).
- Bóng Mực có thêm trạng thái `drain`; `wander` giờ đi tìm đèn yếu gần nhất, hoặc đèn tắt gần nhất.
- Sức chứa không còn cố định 10: **10 + 2 × successful_lights**, tối đa 20.
- Snapshot: mỗi đèn thêm `fuel`, `ever_lit`, `relit_count`; `player.capacity`. Sự kiện `lantern_lit` thêm trường `relight`.

### Added
- Sự kiện `refuel`, `lantern_out`, `fuel_drain` (mỗi 60 tick khi đang hút).
- Scenario: đèn nhận `fuel`, `ever_lit`, `relit_count`; `player.successful_lights`; `shades[].target_lantern_id`; trạng thái `drain`.
- Tuning: `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`, cùng các khóa điểm mới.
- Client: thanh dầu trên đèn, nhấp nháy 1 Hz khi dầu < 30; chế độ "Bảng màu dễ phân biệt"; HUD hiện số đèn cần giữ sáng và sức chứa; hỗ trợ nhiều tỷ lệ màn hình; cài đặt giới hạn FPS và hiển thị FPS.

## [phase-2] Ticket-02 "Ba hòn đảo" (contract v1.1)
- Áp số chuẩn, thêm 3 bản đồ, lướt, rơi khỏi đảo, Gió Lạc, Bùa Gió, gió mạnh, tạm dừng; Bóng Mực có 5 trạng thái. Chi tiết: `docs/notes/phase-2.md`.

## [phase-1] PRD-0 (contract v1.0)
- Đêm 1 chơi được, chế độ headless, test contract.
