# Changelog

## [v1.0.1] Bản cập nhật sau phát hành

### Added
- **Chế độ Mod** (mã `787898`, gõ khi đang chơi hoặc nhập trong menu tạm dừng): mọi đèn sáng, luôn đầy dầu, Mây bất tử. Lượt có Mod không được lưu vào bảng xếp hạng. Luật nằm trong `Sim.setCheats()`, mặc định tắt (3 test mới, tổng 69).
- `npm start` in ra địa chỉ LAN để máy khác cùng mạng vào chơi và dùng chung bảng xếp hạng; README có hướng dẫn mời người ngoài Internet bằng Cloudflare Quick Tunnel.

### Unchanged
- Test Contract v1.3, đầu ra headless, soak và bench không đổi (Mod không bao giờ bật trong các chế độ này).

## [v1.0.0 / phase-4] Ticket-04 "Bình minh: phát hành" (contract v1.3)

### Added
- `bench_cmd` (`node scripts/bench.mjs`): cảnh benchmark chuẩn (200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng), cửa sổ 1280×720, tắt vsync, camera bay vòng tròn; xuất `bench.json` (avg/p1-low FPS, p95 frame ms, load_ms, peak RSS).
- `soak_cmd` (`node --expose-gc --max-semi-space-size=1 src/soak.mjs`): 10 đêm liên tiếp, input ngẫu nhiên theo seed, xuất `soak.json`.
- Bảng xếp hạng cục bộ: lưu sau Bình Minh hoặc sau khi thua, top 10, màn hình ở menu, xuất bằng `--export-leaderboard`.
- Accessibility: đổi phím (báo trùng phím, khôi phục mặc định), phụ đề và mũi tên chỉ hướng, giảm chuyển động, chữ ≥ 18 px, chữ lớn ×1.25.
- Đảo sinh động hơn (nhà sàn, bến thuyền, tre, đá, hoa, cỏ); video menu; nhạc menu.

### Changed
- `run_cmd` đổi thành `node scripts/serve.mjs` (để `<run_cmd> --export-leaderboard out.json` chạy được trực tiếp).
- Tìm đèn gần nhất không còn sao chép và sắp xếp lại danh sách mỗi tick (giảm rác bộ nhớ trong soak và bench). Đầu ra headless không đổi.
- Không có breaking change với contract v1.0–v1.2.

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
