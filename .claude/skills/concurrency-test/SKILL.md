---
name: concurrency-test
description: Run or write a concurrency test that simulates multiple members borrowing the same last available book copy at the same time, to verify the locking strategy (SELECT FOR UPDATE SKIP LOCKED / optimistic locking) prevents double-borrowing. Use when the user asks to test race conditions, concurrent borrow requests, or validate the locking mechanism.
---

# concurrency-test

Kiểm chứng cơ chế xử lý tương tranh khi mượn sách — phần trọng tâm của đồ án (mục 2.3, 4.3 trong `library-system-spec.md`; mục 3 trong `docs/DATABASE.md`).

## Trước khi dùng
API `POST /loans/borrow` đã triển khai với transaction locking (`PLAN.md` Phase 5). Có ít nhất 1 sách trong DB chỉ còn đúng 1 `book_copy` ở trạng thái `available` (dùng skill `db-seed`).

## Cách thực hiện
1. Nếu chưa có, tạo `backend/tests/test_concurrency.py` dùng `concurrent.futures.ThreadPoolExecutor` hoặc `asyncio.gather` để bắn N (VD: 10) request `POST /loans/borrow` đồng thời cho cùng 1 `book_id` chỉ còn 1 bản sao, với N độc giả (`member_id`) khác nhau.
2. Assertion bắt buộc:
   - Đúng 1 request trả về thành công (201/200).
   - N-1 request còn lại trả lỗi rõ ràng (VD: 409 Conflict / "no copy available"), **không** được lỗi 500 hoặc treo (deadlock/timeout).
   - Sau khi chạy xong, đếm số `loans` với `book_copy_id` đó và `returned_at IS NULL` phải đúng bằng 1.
3. Chạy: `cd backend && pytest tests/test_concurrency.py -v`
4. Ghi lại kết quả (số request thành công/thất bại, thời gian chạy) vào `docs/DATABASE.md` mục 9 ("Kết quả thực nghiệm") — dùng làm minh chứng cho báo cáo đồ án.

## Nếu test fail (2+ request cùng thành công)
- Kiểm tra transaction có đang dùng đúng `SELECT ... FOR UPDATE` (không phải plain `SELECT`) trước khi `INSERT` vào `loans` hay không.
- Kiểm tra isolation level của SQLAlchemy session (mặc định Postgres `READ COMMITTED` là đủ khi kết hợp `FOR UPDATE`, không cần `SERIALIZABLE`).
- Không tự ý đổi chiến lược locking mà không ghi lại lý do trong `docs/DATABASE.md` — đây là phần trọng tâm được chấm điểm.
