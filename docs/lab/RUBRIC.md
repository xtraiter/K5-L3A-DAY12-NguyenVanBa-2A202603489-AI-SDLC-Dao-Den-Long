# Rubric: Day 12 AI SDLC

> Bài **cá nhân**. Thang điểm **100**.
> Sản phẩm của bạn được chấm bằng cả **bộ kiểm tra tự động của giảng viên** lẫn **bằng chứng bạn cung cấp**.
> Đồ họa hay độ phức tạp vượt yêu cầu **không** được cộng điểm. Game tốt là game đúng yêu cầu. **Sáng tạo gọn và đúng** (không phá phần lõi) được tính trong hạng mục F.

---

## 1. Tổng quan

| Hạng mục | Điểm | Cách chấm |
|---|---:|---|
| A. Test tự động ẩn | 30 | Giảng viên chạy trên repo của bạn ở từng tag, kể cả kiểm tra lại các phase trước |
| B. Kiểm chứng và bằng chứng của bạn | 20 | Xem mục 2 |
| C. Quy trình SDLC và harness AI | 15 | Xem mục 3 |
| D. Evaluation và retro | 10 | Xem mục 4 |
| E. Hiệu năng và ổn định | 10 | Đo trên cùng một máy chấm cho mọi bài |
| F. Chất lượng sản phẩm và sáng tạo | 10 | 6 điểm đúng yêu cầu và chơi được; 4 điểm sáng tạo (xem mục 5) |
| G. Video demo | 5 | Dưới 5 phút, có phần bằng chứng |

Điểm phân bổ giữa các phase: hạng mục A chia cho 4 phase, các phase sau có trọng số cao hơn vì cần cả kiểm tra lại các phase trước.

---

## 2. B. Kiểm chứng và bằng chứng (20)

Định dạng bằng chứng do bạn chọn. Điều được xem là **bạn chứng minh được ý đó** bằng bất kỳ cách nào hợp lý.

| Tiêu chí | Điểm tối đa | Mức đạt tối đa |
|---|---:|---|
| Truy vết yêu cầu đến bằng chứng | 5 | Mỗi yêu cầu chính của mọi phase có cách kiểm chứng, bằng chứng và kết quả. Chỗ chưa đạt ghi trung thực |
| Bằng chứng thật, khớp tag | 4 | Giảng viên chạy lại một vài mục ở tag tương ứng và ra cùng kết quả |
| Test và scenario của bạn | 4 | Có test đơn vị và các scenario headless của riêng bạn, chạy được bằng một lệnh; có kiểm tra tính tất định nếu yêu cầu |
| Tự động hóa kiểm chứng | 3 | Ví dụ CI chạy test mỗi lần push, hoặc cách tương đương để kiểm chứng không phụ thuộc trí nhớ |
| Agent tự kiểm chứng | 4 | Agent có cách chạy game và lưu bằng chứng; có cơ chế ngăn kết thúc khi test đỏ; việc đánh giá do người hoặc agent khác người đã viết |

## 3. C. Quy trình SDLC và harness AI (15)

| Tiêu chí | Điểm tối đa | Mức đạt tối đa |
|---|---:|---|
| Hiểu và làm rõ yêu cầu | 4 | Mỗi phase có giả định rõ ràng, tiêu chí nghiệm thu kiểm chứng được |
| Xử lý thay đổi yêu cầu | 3 | Khi yêu cầu đổi, bạn ghi lý do, cập nhật thiết kế và test; test cũ được sửa hoặc bỏ kèm lý do |
| File hướng dẫn cho agent | 3 | Ngắn gọn, có lệnh build và test, quy ước; được cập nhật qua các phase (lịch sử git chứng minh) |
| Kỹ năng, hook, công cụ | 3 | Có ít nhất một thành phần harness thật sự hữu ích ngoài file hướng dẫn, mô tả rõ khi nào dùng |
| Git | 2 | Commit nhỏ, thông điệp rõ, tag đủ 4 phase, Release `v1.0.0` |

## 4. D. Evaluation và retro (10)

| Tiêu chí | Điểm tối đa | Mức đạt tối đa |
|---|---:|---|
| Đánh giá từng phase | 4 | Mỗi phase có đánh giá ngắn: yêu cầu nào đạt, có hỏng phase trước không, điều cần chỉnh |
| Phân tích lỗi của AI | 2 | Các lần AI sai (bịa yêu cầu, test giả, sửa sai chỗ), cách bạn phát hiện, bạn chỉnh harness thế nào để không lặp lại |
| Dùng token có cân nhắc | 2 | Ghi ước tính token hoặc chi phí mỗi phase và cách bạn tiết kiệm. Không thưởng cho việc đốt nhiều token |
| Retro | 2 | Tổng hợp cả dự án: số liệu, bài học, nếu làm lại thì đổi gì |

## 5. A, E, F, G (tóm tắt)

- **A. Test tự động ẩn (30):** kịch bản của giảng viên chạy qua chế độ headless theo Test Contract. Kịch bản không công bố. Test của phase trước vẫn được chạy lại ở phase sau, trừ những test đã bị yêu cầu mới thay thế (bạn sẽ được cho biết rõ trong ticket).
- **E. Hiệu năng và ổn định (10):** đo bằng lệnh theo tài liệu phase, trên cùng một máy chấm cho mọi bài. Chấm theo ngưỡng của yêu cầu, không so với bài khác.
- **F. Chất lượng sản phẩm và sáng tạo (10):** 6 điểm cho phần đúng yêu cầu và chơi được; 4 điểm cho sáng tạo. Sáng tạo chỉ được tính khi (1) không phá yêu cầu và Test Contract (thực thể thêm không làm đổi đầu ra headless), (2) có mục "Sáng tạo của tôi" trong README kèm bằng chứng ngắn, (3) gọn và chạy ổn. Ý nhỏ, rõ, chạy đúng hơn nhiều ý dở dang. Với phần đúng yêu cầu: chơi thử và đối chiếu với yêu cầu. Đúng yêu cầu và chơi được là chính; mỹ thuật, giao diện và âm thanh ở mức đủ. **Không cộng điểm** cho độ phức tạp hay đồ họa vượt yêu cầu.
- **G. Video demo (5):** dưới 5 phút, `.mp4`, mở được khi chưa đăng nhập; có chơi thử và cho thấy bằng chứng game chạy đúng (kiểm tra đạt, và đo hiệu năng nếu có).

## 6. Trừ điểm và điều kiện

| Tình huống | Hậu quả |
|---|---|
| Nộp muộn | Trừ điểm theo quy định khóa |
| Thiếu tag hoặc Release `v1.0.0` | Phần của phase thiếu không được chấm; giảng viên có thể không chấm các phase sau |
| Bằng chứng giả (test luôn đạt, sửa tay output, clip không khớp mã) | Vi phạm nghiêm trọng; xử lý theo [RULES.md](RULES.md) mục 5 |
| Sao chép bài người khác | Xử lý theo [RULES.md](RULES.md) mục 6 |
| Repo không public, không clone được | Không chấm được |
| Lộ khóa API trong repo | Trừ điểm; xem [RULES.md](RULES.md) mục 9 |

## 7. Điều bạn nên làm để điểm cao

1. Hiểu đúng yêu cầu, ghi giả định, kiểm chứng theo giả định đó.
2. Nghĩ cách kiểm chứng trước khi để agent viết code.
3. Giữ bằng chứng thật và khớp mã.
4. Giữ harness của bạn nhỏ, hữu ích, và cập nhật khi agent sai lặp lại.
5. Theo dõi token. Gọn và đúng thắng dài và đắt.
