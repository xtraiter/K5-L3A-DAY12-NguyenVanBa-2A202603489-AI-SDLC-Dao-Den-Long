# Lộ trình Checkpoints: Day 12 AI SDLC

> **Cá nhân.** Làm lần lượt Checkpoint 0 đến 5. Mỗi checkpoint là một mốc tự kiểm tra, không phải bài nộp riêng.
> Yêu cầu của từng phase nằm trên **[lab board](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**. Tài liệu này không lặp lại và không tiết lộ yêu cầu phase sau.
> Cách làm: [GUIDE.md](GUIDE.md). Nộp bài: [SUBMISSION.md](SUBMISSION.md).
> Cách trình bày bằng chứng, tên file và cấu trúc thư mục do bạn chọn. Các gợi ý dưới đây chỉ là ví dụ.

## Lịch 4 giờ

| Checkpoint | Mốc | Thời lượng |
|---|---|---|
| CP0 Chuẩn bị | 0h (trong giờ Phase 1) | khoảng 10 phút |
| CP1 Phase 1 | 0h đến 1h | 60 phút (gồm CP0) |
| CP2 Phase 2 | 1h đến 2h | 60 phút |
| CP3 Phase 3 | 2h đến 2h30 | 30 phút |
| CP4 Phase 4 và phát hành | 2h30 đến 4h | 90 phút |
| CP5 Video và nộp | trong 15 phút cuối của giờ thứ tư | 10 đến 15 phút |

Hết giờ mỗi phase: gắn tag, push, rồi đi tiếp.

## Big picture

```
CP0 Chuẩn bị  ->  CP1 Phase 1  ->  CP2 Phase 2  ->  CP3 Phase 3  ->  CP4 Phase 4 + Release  ->  CP5 Nộp bài
```

Mỗi checkpoint phase (CP1 đến CP4) có cùng một khung, nhưng nội dung yêu cầu do ticket của phase đó quyết định:

| Bước | Câu hỏi tự kiểm tra |
|---|---|
| Hiểu | Mình đã tách được yêu cầu bắt buộc khỏi chỗ mơ hồ chưa? Giả định đã ghi chưa? |
| Kế hoạch kiểm chứng | Với mỗi yêu cầu chính, mình biết cách chứng minh nó chạy đúng chưa? |
| Xây dựng | Agent làm theo kế hoạch đã duyệt chưa? Commit có nhỏ và rõ không? |
| Kiểm chứng | Mọi yêu cầu chính đã có bằng chứng thật chưa? Cái nào chưa đạt đã ghi trung thực chưa? |
| Hồi quy | Những gì đúng ở phase trước còn đúng không? Test nào bị yêu cầu mới làm sai đã được sửa hoặc bỏ kèm lý do chưa? |
| Đánh giá | AI đã sai ở đâu? Mình chỉnh harness gì? Mình đã dùng bao nhiêu token? |
| Phát hành | Đã gắn tag `phase-N` và push chưa? |

---

## Checkpoint 0: Chuẩn bị (khoảng 10 phút)

**Mục tiêu:** có môi trường làm việc và repo sẵn sàng. Nên chuẩn bị **trước** buổi lab nếu có thể. Nếu không, làm ngay đầu giờ Phase 1.

Việc cần làm:
- [ ] Tạo **repo cá nhân, public** trên GitHub, đặt tên theo [SUBMISSION.md](SUBMISSION.md).
- [ ] Chọn công cụ AI, engine và ngôn ngữ. Cài và chạy thử một chương trình "hello" 3D hoặc headless để chắc môi trường ổn.
- [ ] Đăng nhập claude.ai, mở lab board, thử mở tab Phase 1 và hỏi trợ giảng một câu bất kỳ để chắc trợ giảng hoạt động.
- [ ] Tạo sẵn nơi ghi chép (một file hoặc một thư mục tùy bạn) cho giả định, nhật ký dùng AI và bằng chứng.
- [ ] Kiểm tra hạn nộp từng phase theo thông báo của Coach.

Tự kiểm: clone repo sang thư mục khác và chạy được chương trình thử.

---

## Checkpoint 1: Phase 1 (PRD-0), 0h đến 1h

**Mục tiêu:** từ một mô tả tổng quát và mơ hồ, làm ra một bản chơi được của màn đầu tiên, kèm chế độ headless theo Test Contract, và chứng minh nó đúng.

Gợi ý:
- [ ] Đọc PRD-0 hai lần. Lần một đọc để hiểu game. Lần hai gạch chân những chỗ mơ hồ và những chỗ **bắt buộc chính xác** (Test Contract).
- [ ] Viết giả định cho từng chỗ mơ hồ, và các con số bạn tự chọn. Những con số này sẽ cần khai báo theo yêu cầu của contract.
- [ ] Tách logic game khỏi phần hiển thị để chạy được headless.
- [ ] Tự viết vài scenario nhỏ và kiểm tra đầu ra đúng định dạng.
- [ ] Chạy hai lần cùng đầu vào và so sánh, nếu contract yêu cầu tính tất định.
- [ ] Làm đúng các bàn giao liệt kê trong PRD-0.

Tự kiểm:
- [ ] Clone sạch, làm theo README của bạn, chạy được game.
- [ ] Mỗi yêu cầu chính có bằng chứng; chỗ chưa đạt đã ghi.
- [ ] Đã gắn tag `phase-1` và push.

---

## Checkpoint 2: Phase 2 (Ticket-02), 1h đến 2h

**Mục tiêu:** tiếp nhận yêu cầu mới, mở rộng sản phẩm mà không làm hỏng những gì đã đúng.

Gợi ý:
- [ ] Đọc ticket, so với những giả định ở Phase 1. Chỗ nào ticket đã làm rõ hoặc đổi, cập nhật giả định.
- [ ] Viết kế hoạch kiểm chứng cho phần mới **trước** khi code.
- [ ] Chạy lại toàn bộ kiểm chứng của Phase 1 sau khi tích hợp.
- [ ] Rà soát harness: agent có sai lặp lại không? Đã đến lúc thêm một dòng vào hướng dẫn, một skill hay một hook chưa?

Tự kiểm:
- [ ] Phần mới có bằng chứng; phần cũ không bị hỏng (hoặc có lý do rõ ràng nếu đổi).
- [ ] Đã gắn tag `phase-2` và push.

---

## Checkpoint 3: Phase 3 (Ticket-03), 2h đến 2h30

**Mục tiêu:** xử lý một thay đổi yêu cầu có thể **thay thế** những luật đã có.

Gợi ý:
- [ ] Đọc kỹ những chỗ ticket nói luật cũ bị thay. Liệt kê những test, tài liệu và giả định cũ bị ảnh hưởng.
- [ ] Ghi lại ngắn gọn bạn thay đổi thiết kế thế nào và vì sao (một đoạn ngắn là đủ).
- [ ] Test cũ bị luật mới làm sai: **sửa hoặc bỏ kèm lý do**, không bỏ qua âm thầm.
- [ ] Chạy lại tất cả kiểm chứng còn hiệu lực.

Tự kiểm:
- [ ] Người khác đọc ghi chú của bạn hiểu được vì sao đổi hướng.
- [ ] Không còn test bị tắt mà không có lý do.
- [ ] Đã gắn tag `phase-3` và push.

---

## Checkpoint 4: Phase 4 và phát hành (Ticket-04), 2h30 đến 4h

**Mục tiêu:** đưa sản phẩm đến mức phát hành được, đo được, cài đặt dễ.

Gợi ý:
- [ ] Đọc các yêu cầu có **số đo cụ thể** trong ticket. Với mỗi yêu cầu đo, chạy thật và lưu kết quả cùng cấu hình máy.
- [ ] Làm sạch README: người khác clone sạch, làm theo, chạy được trong tối đa 3 lệnh.
- [ ] Đảm bảo file bản quyền, ghi nguồn asset, giấy phép.
- [ ] Tạo bản phát hành chạy được (file thực thi, thư mục web tĩnh hoặc Docker) và GitHub Release `v1.0.0`.

Tự kiểm:
- [ ] Thử trên một thư mục sạch hoặc máy khác, không dùng cấu hình sẵn của bạn.
- [ ] Đã gắn tag `phase-4` và tạo Release `v1.0.0`.

---

## Checkpoint 5: Video demo và nộp bài (10 đến 15 phút cuối)

**Mục tiêu:** hoàn tất ghi chép, quay video, kiểm tra lần cuối, nộp.

- [ ] **Retro ngắn:** điều gì hiệu quả hoặc không khi làm với AI; những lần AI sai và cách bạn phát hiện; harness nào giúp nhiều nhất; token/chi phí ước tính và cách bạn tiết kiệm; nếu làm lại thì đổi gì.
- [ ] **Video demo `.mp4` dưới 5 phút**: chơi thử và cho thấy bằng chứng game chạy đúng. Đính kèm Release `v1.0.0` hoặc commit vào `docs/demo/demo.mp4` (dưới 100 MB). Đặt link ở đầu README.
- [ ] Rà soát repo: không có `.env`, API key, token. Lịch sử git còn đủ file harness.
- [ ] Rà soát bằng danh sách ở [SUBMISSION.md](SUBMISSION.md) mục "Checklist trước khi nộp".
- [ ] Nộp link repo public theo hướng dẫn của Coach.
