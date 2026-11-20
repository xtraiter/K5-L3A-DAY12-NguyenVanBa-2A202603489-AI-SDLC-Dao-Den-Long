# Bằng chứng Phase 4 (v1.0.0)

| Yêu cầu Ticket-04 | Bằng chứng | Kết quả (máy dev) |
|---|---|---|
| §1 Bench: avg ≥ 60, p1-low ≥ 30, load ≤ 10 s | [bench.json](bench.json) | 99,2 / 56,3 / 869 ms: Đạt |
| §2 Soak: 0 crash, RSS ≤ 1,2× | [soak.json](soak.json) | 0 crash, 45,8 → 51,9 MB (×1,13): Đạt |
| §3 Bảng xếp hạng | `tests/release.test.mjs` (5 test), [screens/08-leaderboard.png](screens/08-leaderboard.png) | Đạt |
| §4 Accessibility | [screens/07-settings.png](screens/07-settings.png) (đổi phím, giảm chuyển động, chữ lớn), [screens/03-night1.png](screens/03-night1.png) (phụ đề, mũi tên khi Bóng Mực xuất hiện) | Đạt (kiểm tra hiển thị và bằng tay) |
| §5 Đóng gói | README, CHANGELOG (4 phase), CREDITS, LICENSE; Release v1.0.0 | Release: cần tải lên GitHub |
| §6 Contract v1.3 | `game.contract.json`; test `contract v1.3` | Đạt |
| Test Phase 1–3 | `npm test`: 66/66 | Đạt |
| §7 Retro, video demo | [retro.md](../../notes/retro.md); video demo do người chơi quay | Video: chưa có |

Máy đo: AMD Ryzen 7 4800H, NVIDIA RTX 3060 Laptop, 31 GB RAM, Windows 11, Chrome (chi tiết trong bench.json).
