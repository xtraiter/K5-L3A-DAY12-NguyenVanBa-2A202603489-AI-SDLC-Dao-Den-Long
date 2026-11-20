# ADR 0001: Đèn có nhiên liệu, thắng bằng cách sống sót tới bình minh

- Trạng thái: Đã chấp nhận (Phase 3, Ticket-03 "Đèn cạn dầu", contract v1.2)
- Thay thế: luật "đèn đã sáng là sáng mãi", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi thắp hết đèn"

## Bối cảnh

Ở Phase 2, đèn chỉ có hai trạng thái (`lit` true/false) và chỉ chuyển một chiều: chưa sáng → sáng. Người chơi giỏi thắp hết đèn trong khoảng 2 phút rồi đêm kết thúc, nên cuối đêm thiếu căng thẳng. Ticket-03 yêu cầu đèn có thể tắt và mục tiêu chuyển thành "giữ đảo sáng tới bình minh".

## Quyết định

### 1. Mô hình trạng thái đèn

```
                  nạp đủ cost (10 nếu chưa từng sáng, 5 nếu ever_lit)
   ┌──────────┐  ───────────────────────────────────────────────▶  ┌──────────────────┐
   │  TẮT     │                                                     │  SÁNG            │
   │ fuel = 0 │  ◀───────────────────────────────────────────────  │  fuel ∈ (0, 100] │
   └──────────┘   fuel ≤ 0 (hao 1/s + mỗi Bóng Mực hút 5/s)         └──────────────────┘
        ▲  deposited = 0, ever_lit giữ true, phát lantern_out          │  châm dầu: +10/đom đóm
        │                                                              ▼  (tối đa 100)
                       vùng an toàn chỉ có khi SÁNG và fuel ≥ 30 ("đèn mạnh")
```

- Mỗi đèn có thêm `fuel`, `everLit` và `relitCount`. Cờ `lit` vẫn giữ (đúng contract), còn "đèn mạnh" (có vùng an toàn) được suy ra từ `lit && fuel ≥ 30`, không lưu thành một cờ riêng. Nhờ vậy không có hai nguồn sự thật có thể lệch nhau.
- **Dầu lưu bằng số nguyên, đơn vị 1/60 điểm dầu.** Hao 1/s đúng bằng 1 đơn vị mỗi tick, bị hút 5/s đúng bằng 5 đơn vị mỗi tick, mỗi đom đóm châm vào bằng 600 đơn vị. Không có sai số số thực, và bình minh luôn rơi đúng vào tick ngưỡng. Chỉ khi xuất ra mới quy đổi và làm tròn 1 chữ số thập phân.
- Bước 2 của tick trừ dầu (hao tự nhiên cộng phần bị hút) rồi tắt các đèn có fuel ≤ 0, đúng thứ tự ticket quy định. Đèn tắt thì Bóng Mực đang hút nó chuyển về `wander`.
- Tương tác: chỉ xét đèn còn nhận được đom đóm (chưa sáng, hoặc sáng nhưng chưa đầy dầu), chọn đèn gần nhất, bằng nhau thì id nhỏ hơn. Đèn sáng thì châm dầu, đèn tắt thì nạp để thắp (lần đầu hoặc thắp lại).

### 2. Bóng Mực có thêm trạng thái `drain`

`wander → drain` khi tới gần (≤ 2 m) đèn yếu gần nhất. `drain → chase` khi Mây tới trong 6 m. `drain → stunned` khi trúng Tỏa Sáng. `drain → wander` khi đèn tắt, khi dầu được châm lên ≥ 30, hoặc khi cách đèn > 2 m. Khi dầu được châm lên ≥ 30, Bóng Mực trong vùng bị đẩy ra theo cùng cơ chế dùng khi vừa thắp đèn (≤ 30 tick, không gây sát thương). Cơ chế đẩy ra được dùng chung, không viết một cơ chế riêng.

### 3. Luật thắng

Xét ở bước 11, sau mọi cập nhật của tick: hết Ngọn Lửa → thua `no_flames` (ưu tiên trước, kể cả ở tick bình minh). Hết giờ: số đèn đang sáng ≥ ceil(0.6 × tổng đèn) → thắng `dawn_survived`, ngược lại thua `dawn`. Không còn thắng sớm. Ngưỡng được tính bằng số học nguyên `ceil(n·6/10)` để tránh lỗi số thực (ví dụ 0.6 × 5).

## Hệ quả

- Test Phase 2 bị luật mới thay thế được sửa hoặc thay, có ghi lý do (xem `docs/notes/phase-3.md`). Không test nào bị bỏ qua (skip).
- Client phải hiển thị thanh dầu, nhấp nháy 1 Hz khi dầu < 30, và đèn tắt có hình dạng khác (xẹp, giấy rách) cho chế độ mù màu.
- Điểm `per_second_left` về 0 (thưởng thời gian bị bỏ). Các khóa điểm mới được thêm vào `tuning.score`.
- Rủi ro: Bóng Mực "wander" giờ có mục tiêu (đèn yếu hoặc đèn tắt), nên vị trí của chúng khác Phase 2. Các test chỉ kiểm tra trạng thái và khoảng cách, không phụ thuộc vị trí chính xác.
