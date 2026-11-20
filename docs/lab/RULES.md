# Quy định Lab: Day 12 (RULES)

> Đọc cùng [README.md](README.md), [SUBMISSION.md](SUBMISSION.md), [RUBRIC.md](RUBRIC.md).
> Bài này là bài **cá nhân** (1 MSSV, 1 repo, 1 link nộp).

---

## 1. Hình thức và nộp bài

- **Cá nhân:** mỗi học viên tự làm và tự nộp **link repo public** của mình theo hướng dẫn của Coach.
- Dù lớp có trao đổi chung, **không** nộp chung một repo cho nhiều MSSV.
- Tên repo theo quy ước ở [SUBMISSION.md](SUBMISSION.md).

## 2. Deadline

- Lab kéo dài **4 giờ**, Phase 1, 2, 3, 4 phát hành đúng mốc giờ (0h, 1h, 2h, 2h30, hết giờ lúc 4h).
- Hạn tag mỗi phase là mốc giờ phát hành phase kế tiếp. Tag `phase-4`, Release và video hạn là hết giờ lab. Chi tiết ở [SUBMISSION.md](SUBMISSION.md).
- Thời điểm tính là thời điểm của tag và Release trên GitHub.
- Hạn nộp link lên LMS: theo thông báo của Coach, mặc định **23h59 cùng ngày làm Lab đối với ca sáng và 11h59 trưa ngày hôm sau đối với ca chiều** (ICT / GMT+7). Sau khi hết giờ lab không commit thêm nội dung sản phẩm.
- Gia hạn chỉ khi Key Coach thông báo trong vòng 48 giờ sau Lab.
- Sau hạn: nộp muộn bị trừ điểm theo quy định khóa; commit và tag sau hạn có thể không được tính.

## 3. Dùng AI

- **Được dùng AI thoải mái** (Claude Code, Codex, Cursor, Copilot, Grok, ChatGPT, ...) ở mọi bước.
- Bạn phải **hiểu** và **giải thích được** phần mình nộp khi Key Coach hỏi.
- Điểm không đến từ việc bạn tự gõ bao nhiêu dòng, mà từ việc bạn **dẫn dắt và kiểm chứng** AI tốt đến đâu.
- Đừng giao việc cho AI mà không kiểm chứng. "Agent bảo chạy rồi" không phải bằng chứng.

## 4. Quota token và chi phí

- Quota token của bạn là tài nguyên có hạn. **Đốt nhiều token không làm bài tốt hơn** và không được cộng điểm.
- Ghi lại ước tính token hoặc chi phí mỗi phase và cách bạn tiết kiệm. Việc này có điểm.
- Không chia sẻ tài khoản hoặc key AI với người khác để lấy thêm quota.

## 5. Trung thực về bằng chứng

- Bằng chứng phải **thật** và **khớp mã ở tag tương ứng**.
- Các việc sau bị coi là vi phạm nghiêm trọng: test được viết để luôn đạt; sửa tay output của chương trình để giống kết quả mong đợi; ảnh hoặc clip không khớp mã nộp; ghi "đạt" cho yêu cầu chưa làm.
- Yêu cầu chưa đạt thì ghi "chưa đạt" kèm lý do. Ghi trung thực **không** bị trừ điểm vì thiếu tính năng nhiều hơn vì giấu lỗi.

## 6. Sao chép và gian lận

- Không sao chép code, bằng chứng hoặc ghi chép của bạn khác.
- Giảng viên có thể so sánh mã giữa các bài. Hai bài giống nhau bất thường có thể bị coi là gian lận theo quy định khóa.
- Trao đổi ý tưởng được; nộp bài giống nhau thì không.

## 7. Harness AI và lịch sử git

- **Không xóa** các file harness (AGENTS.md hoặc tương đương, skills, hooks, plugins, cấu hình MCP) sau khi dùng.
- Lịch sử git phải cho thấy chúng tồn tại trong quá trình làm.
- Không viết lại lịch sử (force push làm mất commit cũ) sau khi đã gắn tag.

## 8. Tài sản, bản quyền, bản gốc

- Nhân vật, bối cảnh và tên gọi trong lab là **bản gốc** của lab. Không dùng nhân vật, nhạc, mô hình hoặc thương hiệu của game hay phim có sẵn.
- Asset bên ngoài chỉ dùng nếu giấy phép cho phép (ví dụ CC0, CC-BY, MIT) hoặc do bạn tự tạo, hoặc do AI tạo. Ghi nguồn và công cụ trong `CREDITS`.
- Âm thanh và hình ảnh do AI tạo cũng phải ghi nguồn.

## 9. API key và dữ liệu nhạy cảm

- Giữ API key trong file `.env` **local**, **không commit**.
- Nếu cần mẫu cấu hình, chỉ commit tệp mẫu không có khóa thật.
- Không dán API key vào README, issue, commit message hoặc chat công khai.
- Nếu lỡ commit key: thu hồi key ngay, sau đó mới dọn repo.

## 10. Tính công khai của repo

- Repo phải **Public** khi nộp, kể cả Release và video.
- Không đưa dữ liệu cá nhân của người khác vào repo hoặc video.

## 11. Các thông tin của giảng viên

- Nội dung các phase được phát hành **lần lượt** trên lab board. Không chia sẻ nội dung phase chưa đến cho bạn khác nếu giảng viên chưa phát hành.
- Trợ giảng trên lab board chỉ trả lời trong phạm vi phase đã phát hành; nó không thay thế lời giảng viên.
