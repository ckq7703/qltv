# QLTV — Hệ Thống Quản Lý Thư Viện (đồ án môn Hệ Cơ Sở Dữ Liệu)

## Bối cảnh
- Đây là đồ án cho môn Hệ Cơ sở dữ liệu (Thạc sĩ). Trọng tâm chấm điểm: **thiết kế CSDL chuẩn hóa, transaction/concurrency control, trigger/view/index**, không phải độ hoàn thiện UI hay kiến trúc microservice.
- Đặc tả/phân tích gốc (nguồn sự thật cho schema, API, danh sách tính năng): [library-system-spec.md](library-system-spec.md) — luôn đọc trước khi code.
- Kế hoạch triển khai chi tiết, theo phase, dùng để tiếp tục công việc giữa các session: [PLAN.md](PLAN.md) — đọc và cập nhật mỗi khi bắt đầu/kết thúc một phase.
- Tài liệu kỹ thuật bổ sung: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATABASE.md](docs/DATABASE.md).

## Quy ước quan trọng (đọc kỹ trước khi code)
- Backend chính: Python FastAPI (`backend/`), SQLAlchemy + Alembic.
- NestJS gateway là **tuỳ chọn**, chỉ làm ở phase cuối nếu còn thời gian — không ưu tiên, không chứa business logic.
- Mọi logic liên quan tương tranh (mượn sách) **phải** nằm trong transaction ở tầng DB (`SELECT ... FOR UPDATE SKIP LOCKED`), không xử lý race condition chỉ ở tầng application.
- Trigger/function/view/materialized view định nghĩa qua Alembic migration (`op.execute(...)`), không tạo tay ngoài quy trình migration — để đảm bảo tái lập toàn bộ DB từ đầu.
- Không tự ý đổi schema đã chuẩn hóa trong `library-system-spec.md` mục 4 nếu chưa xác nhận với người dùng.
- Dùng các skill trong `.claude/skills/` cho thao tác lặp lại thay vì gõ lệnh tay mỗi lần.

## Trạng thái hiện tại
Xem chi tiết ở đầu file [PLAN.md](PLAN.md). Tóm tắt: Phase 0-9 backend đã xong (hạ tầng Docker, schema chuẩn hóa, trigger/view/index, CRUD API, concurrency control, auth JWT, cache-aside, benchmark, thống kê) — stack chạy được, đã migrate + seed, 8/8 test pass. Phase 13 (Frontend React + shadcn/ui, layout sidebar, UI tiếng Anh) cũng đã xong, dev server chạy tại `http://localhost:5173`. Còn lại: Phase 10 (backup/PITR, tuỳ chọn), Phase 11 (NestJS gateway, tuỳ chọn), Phase 12 (viết báo cáo).

## Frontend — quy ước riêng
- Stack: React + Vite + TypeScript + Tailwind v4 + shadcn/ui (bản `@base-ui/react`, KHÔNG phải Radix — component dùng prop `render` thay vì `asChild`).
- Layout **sidebar**, không dùng topbar (người dùng đã yêu cầu đổi).
- Toàn bộ text UI bằng **tiếng Anh** (người dùng đã yêu cầu, không quay lại tiếng Việt trừ khi được yêu cầu lại).
- Chạy dev: `cd frontend && npm run dev` (hoặc qua `docker compose up -d frontend`, chưa build-test đường này).

## Khi bắt đầu một session mới
1. Đọc `PLAN.md` để biết đang ở phase nào, việc gì đã xong, việc gì đang dở.
2. Đối chiếu thực tế thư mục dự án với checklist trong `PLAN.md` — nếu lệch (VD: code đã có nhưng PLAN chưa tick), cập nhật PLAN.md cho khớp thực tế trước khi làm tiếp. Code thực tế luôn là nguồn sự thật cuối cùng, không phải PLAN.md.
3. Dùng skill phù hợp trong `.claude/skills/`: `db-stack` (chạy docker), `db-migrate` (Alembic), `db-seed` (dữ liệu mẫu), `concurrency-test` (kiểm chứng khóa tương tranh), `db-benchmark` (đo EXPLAIN ANALYZE).
