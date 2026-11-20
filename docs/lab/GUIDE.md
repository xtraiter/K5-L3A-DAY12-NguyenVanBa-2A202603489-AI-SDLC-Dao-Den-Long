# Hướng dẫn làm lab (GUIDE)

Bài **cá nhân**. Đọc cùng [README.md](README.md). Mốc tự kiểm tra: [CHECKPOINTS.md](CHECKPOINTS.md). Nộp bài: [SUBMISSION.md](SUBMISSION.md). Quy định: [RULES.md](RULES.md). Chấm điểm: [RUBRIC.md](RUBRIC.md).

Tài liệu này chỉ đưa **gợi ý**. Công cụ AI, ngôn ngữ, engine, cách tổ chức thư mục và định dạng tài liệu đều do bạn chọn.

---

## 1. Bức tranh chung

Bạn sẽ làm một dự án game 3D qua 4 phase. Mỗi phase nhận một tài liệu yêu cầu mới (PRD-0 rồi các ticket), và các ticket sau có thể bổ sung hoặc thay đổi những gì đã làm. Bạn không biết trước nội dung phase sau, giống một dự án thật.

```
Phase 1   PRD-0, yêu cầu tổng quát, mơ hồ có chủ đích   -> tag phase-1
Phase 2   Ticket-02                                      -> tag phase-2
Phase 3   Ticket-03                                      -> tag phase-3
Phase 4   Ticket-04, hoàn thiện và phát hành             -> tag phase-4 + Release v1.0.0
```

### Lịch 4 giờ

Lab kéo dài **4 giờ**, Phase 1 và 2 khoảng **1 giờ**, Phase 3 khoảng **30 phút**, Phase 4 khoảng **1 giờ 30 phút**, phát hành đúng mốc giờ:

```
0h   Phase 1 phát hành (gồm chuẩn bị)      tag phase-1 trước 1h
1h   Phase 2 phát hành                      tag phase-2 trước 2h
2h   Phase 3 phát hành                      tag phase-3 trước 2h30
2h30 Phase 4 phát hành                      tag phase-4, Release v1.0.0, video trước 4h
4h   Hết giờ
```

Gợi ý chia **60 phút** cho một phase (Phase 3 chỉ có 30 phút nên rút gọn tương ứng; Phase 4 có 90 phút nên dư thời gian cho đo đạc và phát hành):

| Việc | Thời gian gợi ý |
|---|---|
| Đọc yêu cầu, ghi giả định, nghĩ cách kiểm chứng | 8 đến 10 phút |
| Lập kế hoạch với agent và duyệt | 5 phút |
| Xây dựng theo bước nhỏ | 25 đến 30 phút |
| Kiểm chứng và lưu bằng chứng | 10 đến 12 phút |
| Ghi chú nhanh, gắn tag, push | 3 đến 5 phút |

Phase 1 có thêm khoảng 10 phút chuẩn bị môi trường nên phần xây dựng ngắn hơn. Phase 4 cần dành khoảng 10 đến 15 phút cuối cho Release và video.

**Hết giờ phase thì tag và đi tiếp**, dù chưa hoàn hảo. Một phần ít tính năng nhưng có bằng chứng rõ tốt hơn nhiều tính năng nhưng không kiểm chứng được. Với thời gian này, quyết định phạm vi và dùng token cẩn thận quan trọng hơn bao giờ hết.

Lab board: **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**. Mỗi phase là một tab, tab chưa phát hành bị khóa. Mỗi tab có trợ giảng AI riêng, chỉ trả lời trong phạm vi phase đó.

## 2. Dùng lab board và trợ giảng

- Mở lab board, đọc kỹ tài liệu của phase hiện tại trước khi hỏi bất cứ điều gì.
- Trợ giảng cần bạn **đăng nhập claude.ai** và dùng lượt Claude của chính bạn.
- Trợ giảng trả lời **ngắn, từng ý một**, và chỉ dựa trên nội dung đã công bố của phase đó. Nó không đoán, không làm bài hộ, và không trả lời về phase sau.
- Nếu trợ giảng nói "chưa được quy định": đó là chỗ bạn **tự đưa ra giả định hợp lý**, ghi lại, và kiểm chứng theo đúng giả định đó.
- Khi trợ giảng và giảng viên khác nhau, lời giảng viên là cuối cùng.

## 3. Một vòng làm việc cho mỗi phase

Gợi ý, không bắt buộc đúng thứ tự hay đúng tên file.

1. **Đọc yêu cầu.** Gạch chân những gì bắt buộc (con số, tên lệnh, định dạng output). Liệt kê chỗ mơ hồ.
2. **Viết tiêu chí nghiệm thu ngắn.** Mỗi yêu cầu một câu kiểm tra được ("làm A thì thấy B"). Ghi giả định cho chỗ mơ hồ.
3. **Nghĩ cách kiểm chứng trước khi để agent viết code.** Test, scenario headless, ảnh/GIF, hoặc số đo. Cách kiểm chứng rõ ràng giúp agent làm đúng ngay từ đầu và tiết kiệm token.
4. **Lập kế hoạch với agent**, duyệt kế hoạch, rồi mới cho code. Quyết định lớn nên ghi lại một dòng lý do.
5. **Xây dựng theo bước nhỏ.** Commit nhỏ, mỗi commit một việc. Đọc diff của agent.
6. **Kiểm chứng thật.** Chạy test, chạy game, chạy chế độ headless, lưu bằng chứng. Xem mục 5.
7. **Đánh giá nhanh.** Yêu cầu nào đạt, chưa đạt; AI sai ở đâu; cần chỉnh harness gì.
8. **Phát hành phase.** Cập nhật ghi chú, gắn tag `phase-N`, push.

## 4. Làm việc hiệu quả với agent (harness)

"Harness" là mọi thứ bao quanh model: file hướng dẫn, kỹ năng, hook, công cụ. Gợi ý bắt đầu nhỏ và chỉ thêm khi thấy agent sai lặp lại.

| Thành phần | Dùng để | Gợi ý |
|---|---|---|
| `AGENTS.md` (hoặc `CLAUDE.md`, rules của Cursor...) | Thông tin cố định về dự án: lệnh build, lệnh test, quy ước, điều cấm | Ngắn gọn, vài chục dòng. Mỗi dòng tốn ngữ cảnh ở mọi lần chạy. Cập nhật khi agent mắc cùng lỗi lần thứ hai |
| Skill | Quy trình lặp lại ("cách chạy kiểm chứng", "cách tạo scenario") | Viết một skill chạy game và lưu bằng chứng; chỉ nạp khi cần |
| Hook | Ép một việc luôn xảy ra, không phụ thuộc agent nhớ hay không | Chạy test hoặc lint sau khi agent sửa file; chặn việc kết thúc khi test đang đỏ |
| Subagent / reviewer riêng | Nhìn một thay đổi bằng con mắt khác | Người hoặc agent đánh giá không nên là người hoặc agent đã viết |
| MCP / plugin | Kết nối công cụ ngoài | Chỉ thêm khi thật cần. Mỗi công cụ thêm là thêm ngữ cảnh |

Nguyên tắc: **khi agent sai, hãy sửa ở nơi chắc chắn nhất.** Nếu có thể làm cho lỗi đó không thể xảy ra (kiểm tra tự động, quy tắc trong code) thì ưu tiên hơn là viết thêm chỉ dẫn bằng lời.

## 5. Kiểm chứng và bằng chứng

**Không có bằng chứng thì chưa xong.** "Agent bảo chạy rồi" không phải bằng chứng.

| Loại | Dùng khi | Ví dụ bằng chứng |
|---|---|---|
| Test đơn vị | Logic thuần | Báo cáo test, CI xanh |
| Scenario headless | Hành vi game theo yêu cầu, tái lập được | File đầu vào + output + kết quả mong đợi |
| Kiểm tra tính tất định | Yêu cầu "cùng đầu vào, cùng kết quả" | Chạy hai lần, so output |
| Ảnh, GIF, clip ngắn | Thứ chỉ nhìn mới thấy (đồ họa, HUD, hiệu ứng) | Ảnh chụp kèm mô tả đang kiểm tra yêu cầu nào |
| Số đo | Hiệu năng, ổn định | Kết quả chạy kèm cấu hình máy |

Gợi ý nhỏ:
- Mỗi bằng chứng nên **nói rõ nó chứng minh yêu cầu nào**. Một bảng đơn giản (yêu cầu, cách kiểm chứng, bằng chứng, kết quả) là đủ.
- Yêu cầu chưa đạt thì ghi **"chưa đạt"** và lý do. Ghi trung thực được đánh giá cao hơn giấu.
- Phase sau có thể làm test của phase trước sai. Khi đó **sửa hoặc bỏ test kèm lý do**, đừng tắt âm thầm.
- Bằng chứng phải **khớp với mã ở tag tương ứng**. Chạy lại ở tag đó phải ra cùng kết quả.

## 6. Quản lý token

- Đốt nhiều token **không** làm bài tốt hơn.
- Ngữ cảnh gọn, kế hoạch rõ và kiểm chứng sớm thường vừa rẻ vừa đúng hơn chạy agent liên tục.
- Chia việc nhỏ, giữ AGENTS.md ngắn, dùng model phù hợp cho việc nhẹ (đọc, tìm, định dạng) và model mạnh cho việc khó.
- Dừng và sửa hướng khi agent đi lạc, thay vì để nó chạy tiếp rồi mới dọn.
- Ghi lại ước tính token hoặc chi phí mỗi phase và những cách bạn đã tiết kiệm. Việc này có điểm trong phần đánh giá.

## 7. Game tốt là game đúng yêu cầu

Khách hàng chấm bằng yêu cầu đã nêu, không phải bằng độ phức tạp hay độ đẹp. Làm đúng và chứng minh được là đúng trước, trau chuốt sau. Đồ họa vượt yêu cầu không được cộng điểm.

## 8. Chế độ headless và Test Contract

Để mọi bài được chạy và so sánh bằng cùng một cách, tài liệu yêu cầu của mỗi phase có **Test Contract**: một chế độ chạy không giao diện với định dạng đầu vào và đầu ra cố định. Cách làm gợi ý:

- Đọc Test Contract **trước khi thiết kế kiến trúc**. Tách phần logic game khỏi phần hiển thị để logic chạy được không cần cửa sổ.
- Tự viết vài scenario nhỏ và chạy thử để chắc đầu ra đúng định dạng.
- Mỗi lần contract thay đổi ở phase sau, cập nhật và chạy lại các scenario cũ.

## 9. Quay video demo (dưới 5 phút)

Video `.mp4` dưới 5 phút cho thấy sản phẩm chạy đúng và bằng chứng. Gợi ý nội dung: chơi trực tiếp một đoạn; chạy bộ kiểm tra và cho thấy kết quả đạt; (nếu có) chạy đo hiệu năng; lướt qua bằng chứng và lịch sử git. Cách quay và nén xem [SUBMISSION.md](SUBMISSION.md).

## 10. Xử lý sự cố nhanh

| Tình huống | Gợi ý |
|---|---|
| Agent sửa lung tung nhiều file | Quay về commit gần nhất, giao lại việc nhỏ hơn kèm tiêu chí kiểm chứng |
| Agent bịa yêu cầu không có trong tài liệu | Dẫn nguyên văn đoạn yêu cầu vào lời nhắc; ghi vào nhật ký lỗi AI |
| Test luôn đạt nhưng game sai | Test đang yếu. Thêm kiểm tra bằng scenario hoặc chạy thật rồi xem output |
| Hết quota token giữa chừng | Thu nhỏ phạm vi, bám yêu cầu bắt buộc, ghi rõ phần chưa làm |
| Yêu cầu mới làm hỏng thiết kế cũ | Ghi lý do đổi hướng một dòng, sửa test cũ có lý do, chạy lại toàn bộ |
