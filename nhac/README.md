# Thư mục nhạc

Bỏ file vào đây, game tự nạp. File nào thiếu thì bỏ qua, game vẫn chạy.

| File | Khi phát |
|---|---|
| `maintheme.mp3` | Nhạc menu (lặp) |
| `pickup.mp3` | Nhặt đom đóm |
| `deposit.mp3` | Nạp ánh sáng vào đèn |
| `lit.mp3` | Đèn được thắp |
| `pulse.mp3` | Tỏa sáng |
| `hit.mp3` | Bị Bóng Mực chạm |
| `shade.mp3` | Bóng Mực mới xuất hiện |
| `win.mp3` / `dead.mp3` | Thắng / thua |

Các hiệu ứng còn lại (nhặt, thắp đèn, lướt…) được tạo bằng Web Audio trong `src/client/audio.js`; thêm file trùng tên ở bảng trên thì sẽ không dùng (chỉ nhạc nền, thắng, thua đọc từ file).

Chỉ dùng nhạc tự làm, do AI tạo, hoặc giấy phép CC0/CC-BY/MIT. Ghi nguồn vào `CREDITS.md`. Không dùng nhạc của game/phim có sẵn (RULES mục 8).
