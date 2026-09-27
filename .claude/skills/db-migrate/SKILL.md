---
name: db-migrate
description: Create, apply, or roll back Alembic database migrations for the QLTV backend (schema changes, triggers, views, indexes). Use when the user asks to add or change a table, apply migrations, generate a new Alembic revision, or add a trigger/view/index.
---

# db-migrate

Quản lý migration Alembic cho backend FastAPI của QLTV. Thư mục liên quan: `backend/migrations/`, `backend/alembic.ini`.

## Trước khi dùng
Yêu cầu backend skeleton + Alembic đã init (`PLAN.md` Phase 2). Stack Docker phải đang chạy (dùng skill `db-stack` trước nếu chưa).

## Thao tác
- Tạo migration mới từ thay đổi model: `cd backend && alembic revision --autogenerate -m "<mô tả ngắn>"`
- Migration thủ công (trigger/view/index không autogenerate được): `cd backend && alembic revision -m "<mô tả>"` rồi viết `op.execute("""...""")` trong file được tạo, cả `upgrade()` lẫn `downgrade()`.
- Áp dụng migration: `cd backend && alembic upgrade head`
- Rollback 1 bước: `cd backend && alembic downgrade -1`
- Xem lịch sử: `cd backend && alembic history`

## Quy ước dự án (bắt buộc tuân theo)
- Trigger, function, view, materialized view **phải** được tạo bằng `op.execute()` trong migration riêng, không tạo tay bằng psql ngoài quy trình migration — để đảm bảo tái lập được toàn bộ DB từ đầu (`alembic upgrade head` từ DB rỗng).
- Mỗi migration trigger/view/function phải có `downgrade()` tương ứng (`DROP TRIGGER`/`DROP FUNCTION`/`DROP VIEW`).
- Sau khi autogenerate, luôn đọc lại file migration được sinh ra trước khi áp dụng — Alembic autogenerate có thể bỏ sót thay đổi (đặc biệt CHECK constraint, index đặc biệt như GIN, partial index).
- Đặt tên migration mô tả rõ nội dung (VD: `add_book_copies_and_triggers`), không dùng tên chung chung như `update`.
- Thứ tự migration khuyến nghị (xem `docs/DATABASE.md` mục 1): bảng cơ bản → trigger → view/materialized view → index.
