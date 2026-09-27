---
name: db-seed
description: Seed sample/demo data (authors, categories, books, book copies, members, loans) into the QLTV database for local development and testing. Use when the user asks to populate test data, reset demo data, or needs data to test borrow/return flows.
---

# db-seed

Chèn dữ liệu mẫu vào DB QLTV để phát triển/test cục bộ.

## Trước khi dùng
Stack Docker đang chạy, migration đã áp dụng đầy đủ (chạy `db-stack` rồi `db-migrate` trước nếu cần).

## Cách thực hiện
1. Nếu chưa có script seed, tạo `backend/app/seed.py` dùng SQLAlchemy session để insert:
   - Vài `categories` (kèm ít nhất 1 cấp con để test self-reference `parent_id`)
   - Vài `authors`
   - ~10-20 `books`, mỗi book gắn 1-2 authors qua `book_authors`, và 2-3 `book_copies` (đa số `available`, **ít nhất 1 sách chỉ có 1 copy** để phục vụ test concurrency)
   - Vài `members`
   - Một vài `loans` mẫu, gồm **ít nhất 1 loan quá hạn** (`due_date` trong quá khứ, `returned_at` NULL) để test view `v_overdue_loans`
2. Chạy: `cd backend && python -m app.seed`
3. Script phải idempotent hoặc cảnh báo rõ nếu chạy nhiều lần sẽ tạo trùng dữ liệu — ưu tiên `ON CONFLICT DO NOTHING` hoặc kiểm tra tồn tại trước khi insert.

## Lưu ý
- Không seed dữ liệu thật/nhạy cảm (email thật, số điện thoại thật) — chỉ dùng dữ liệu giả cho mục đích demo đồ án.
- Đảm bảo có ít nhất 1 sách chỉ còn đúng 1 bản sao khả dụng — đây là dữ liệu bắt buộc để skill `concurrency-test` chạy được.
