---
name: db-benchmark
description: Run EXPLAIN ANALYZE benchmarks on key QLTV queries (book search, overdue loans view, top borrowed books) before and after adding an index, and record the results for the academic report. Use when the user asks to benchmark query performance, compare index impact, or gather EXPLAIN ANALYZE output.
---

# db-benchmark

Đo hiệu năng truy vấn trước/sau khi tối ưu index, phục vụ chương "Tối ưu truy vấn" trong báo cáo đồ án (mục 6 trong `library-system-spec.md`, mục 6 trong `docs/DATABASE.md`).

## Trước khi dùng
Stack đang chạy, DB đã có đủ dữ liệu để benchmark có ý nghĩa (khuyến nghị vài nghìn `books`/`loans` giả lập, nhiều hơn dữ liệu demo thường của `db-seed` — có thể viết thêm script `backend/scripts/seed_bulk.py` dùng `generate_series` trong SQL để tạo nhanh dữ liệu lớn).

## Cách thực hiện
1. Kết nối psql: `docker compose exec postgres psql -U <user> -d <db>` (xem `.env` cho thông tin đăng nhập).
2. Với mỗi truy vấn cần đo (tìm kiếm full-text sách, `v_overdue_loans`, `v_top_borrowed_books`...):
   - Chạy `EXPLAIN (ANALYZE, BUFFERS) <query>` **trước** khi có index liên quan (có thể tạm `DROP INDEX` để mô phỏng, nhớ tạo lại ngay sau khi đo).
   - Chạy lại **sau** khi có index, so sánh: loại scan (Seq Scan → Index Scan/Bitmap Index Scan), execution time, số buffer đọc.
3. Ghi kết quả (output `EXPLAIN` đầy đủ + bảng so sánh tóm tắt) vào `docs/BENCHMARKS.md` (tạo file này nếu chưa có).

## Lưu ý
- Không `DROP INDEX` trên môi trường có dữ liệu quan trọng ngoài mục đích benchmark cục bộ; luôn tạo lại index ngay sau khi đo xong ở nhánh "trước index".
- Ưu tiên đo trên tập dữ liệu đủ lớn (hàng nghìn dòng) — với dữ liệu quá nhỏ, Postgres planner có thể chọn Seq Scan dù có index (đúng theo lý thuyết cost-based); nếu gặp trường hợp này, giải thích rõ trong báo cáo thay vì coi là lỗi.
