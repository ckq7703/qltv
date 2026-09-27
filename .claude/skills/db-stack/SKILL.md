---
name: db-stack
description: Start, stop, restart, or reset the local Docker Compose stack (PostgreSQL, Redis, FastAPI backend) for the QLTV project. Use when the user asks to run the project locally, start the database, check container status, or reset containers/volumes.
---

# db-stack

Quản lý Docker Compose stack cục bộ cho dự án QLTV (PostgreSQL + Redis + backend FastAPI).

## Trước khi dùng
Yêu cầu `docker-compose.yml` đã tồn tại ở root project (xem `PLAN.md` Phase 1). Nếu chưa có, dừng lại và báo người dùng cần hoàn thành Phase 1 trước.

## Thao tác thường dùng
- Khởi động: `docker compose up -d`
- Xem log: `docker compose logs -f backend` (hoặc `postgres`, `redis`)
- Trạng thái: `docker compose ps`
- Dừng (giữ data): `docker compose stop`
- Dừng và xoá container (giữ volume): `docker compose down`
- Reset hoàn toàn DB (**xoá data** — luôn xác nhận với người dùng trước khi chạy): `docker compose down -v`
- Kết nối psql vào container Postgres: `docker compose exec postgres psql -U <user> -d <db>` (lấy user/db từ `.env`)
- Kết nối redis-cli: `docker compose exec redis redis-cli`

## Lưu ý
- `docker compose down -v` xoá toàn bộ dữ liệu (volumes) — hành động phá hủy, phải hỏi xác nhận người dùng trước khi chạy, không tự ý chạy.
- Sau khi stack chạy lần đầu (hoặc sau khi reset volume), luôn chạy skill `db-migrate` để áp schema mới nhất trước khi dùng `db-seed`.
