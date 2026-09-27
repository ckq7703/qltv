# Thiết kế & vận hành CSDL — QLTV

> Đây là tài liệu tham chiếu vận hành. **DDL đầy đủ (nguồn sự thật cho schema)** nằm ở [../library-system-spec.md](../library-system-spec.md) mục 4-7 — không copy lại DDL ở đây để tránh lệch giữa 2 file khi schema thay đổi. File này tập trung vào: quy trình migration, giải thích quyết định thiết kế, và nơi ghi lại kết quả thực nghiệm cho báo cáo.

## 1. Quy trình migration (Alembic)

- Mọi thay đổi schema đi qua `backend/migrations/versions/`, không sửa tay DB qua psql (trừ khi debug tạm thời rồi phải phản ánh lại vào migration).
- Migration model (bảng, cột, FK, CHECK) dùng `alembic revision --autogenerate`.
- Migration trigger/function/view/materialized view/index đặc biệt (GIN, partial) dùng `alembic revision` (không autogenerate) + viết tay `op.execute("""...""")` trong cả `upgrade()` và `downgrade()`.
- Thứ tự migration khuyến nghị: (1) bảng cơ bản → (2) trigger đồng bộ `book_copies`/`audit_log` → (3) view/materialized view → (4) index.
- Quy trình chi tiết từng lệnh: xem skill `.claude/skills/db-migrate/SKILL.md`.

## 2. Chuẩn hóa schema (tóm tắt, DDL đầy đủ ở spec mục 4)

- `authors`, `categories` tách riêng khỏi `books` → tránh lặp dữ liệu (2NF/3NF).
- `book_authors` là bảng nối n:n giữa `books` và `authors`.
- `book_copies`: mỗi bản sao vật lý là 1 row (`status`: available/borrowed/lost/damaged) — thay cho việc đếm `total_copies`/`available_copies` trực tiếp trên `books`. `available_copies` trở thành derived data, không lưu trực tiếp.
- `users.member_id` liên kết tuỳ chọn tới `members`, phục vụ phân quyền Member tự tra cứu dữ liệu của chính mình.
- `members.avatar_url` (migration `0005_member_avatar.py`, nullable): ảnh đại diện, phục vụ hiển thị avatar thật trên UI (không ảnh hưởng chuẩn hóa, chỉ là thuộc tính mô tả của thực thể `members`).

## 3. Concurrency control (trọng tâm đồ án)

**Vấn đề**: 2+ độc giả cùng mượn cuốn sách chỉ còn 1 bản sao tại cùng thời điểm.

**Giải pháp chính — Pessimistic locking**:
```sql
SELECT id FROM book_copies
WHERE book_id = :book_id AND status = 'available'
LIMIT 1
FOR UPDATE SKIP LOCKED;
```
- `FOR UPDATE`: khóa row được chọn, transaction khác phải chờ (hoặc bỏ qua nếu dùng `SKIP LOCKED`) cho đến khi transaction hiện tại COMMIT/ROLLBACK.
- `SKIP LOCKED`: transaction khác không chờ mà tự động chọn bản sao *available* khác (nếu còn) thay vì bị block — phù hợp nghiệp vụ mượn sách vì độc giả không quan tâm mượn đúng ID bản sao nào, chỉ cần 1 bản sao khả dụng.
- Isolation level: `READ COMMITTED` (mặc định Postgres) là đủ khi kết hợp với `FOR UPDATE`, không cần `SERIALIZABLE`.

**Phương án so sánh — Optimistic locking** (cột `version` trên `book_copies`):
- Đọc row (không khóa), khi UPDATE thêm điều kiện `WHERE id = :id AND version = :old_version`; nếu 0 row bị ảnh hưởng nghĩa là có transaction khác đã cập nhật trước → retry hoặc báo lỗi.
- Ưu điểm: không giữ khóa lâu, phù hợp tải đọc nhiều/ghi ít. Nhược điểm: cần logic retry ở tầng application, trải nghiệm người dùng kém hơn khi conflict cao.

**Kế hoạch kiểm chứng**: xem skill `.claude/skills/concurrency-test/SKILL.md`. Kết quả benchmark thực nghiệm ghi vào `docs/BENCHMARKS.md` (tạo ở Phase 8).

## 4. Trigger

| Trigger | Bảng | Mục đích |
|---|---|---|
| `trg_after_loan_insert` | `loans` (AFTER INSERT) | Set `book_copies.status = 'borrowed'` |
| `trg_after_loan_return` | `loans` (AFTER UPDATE) | Khi `returned_at` được set, chuyển `book_copies.status = 'available'` |
| Audit triggers | `books`, `loans` | Ghi `old_data`/`new_data` (JSONB) vào `audit_log` |

DDL đầy đủ: spec mục 4.1.

## 5. View & Materialized View

| Tên | Loại | Mục đích |
|---|---|---|
| `v_top_borrowed_books` | View | Sách mượn nhiều nhất, dùng `RANK()` |
| `v_overdue_loans` | View | Phiếu quá hạn, tính động từ `due_date` |
| `v_active_members` | View | Độc giả hoạt động nhiều nhất, `DENSE_RANK()` |
| `mv_monthly_stats` | Materialized View | Thống kê theo tháng, cần `REFRESH MATERIALIZED VIEW` định kỳ |

DDL đầy đủ: spec mục 4.2.

## 6. Index & tối ưu truy vấn

- `idx_books_search` (GIN trên `tsvector`): full-text search cho tên/tác giả sách.
- `idx_books_category`, `idx_loans_member`: index B-tree cho join/filter thường dùng.
- `idx_copies_book_status`: composite index cho truy vấn tìm bản sao khả dụng.
- `idx_loans_open` (partial index `WHERE returned_at IS NULL`): giảm kích thước index vì chỉ quan tâm phiếu mượn chưa trả.
- Quy trình đo trước/sau: skill `.claude/skills/db-benchmark/SKILL.md`, kết quả ghi vào `docs/BENCHMARKS.md`.

## 7. Cache Redis (cache-aside)

- Key cache: hash của query params tìm kiếm sách (VD: `books:search:<hash>`).
- TTL ngắn (VD: 60s) thay vì invalidate chủ động phức tạp — chấp nhận eventual consistency, giải thích trade-off này trong báo cáo (liên hệ CAP theorem).
- Khi trigger cập nhật `book_copies.status`, cân nhắc invalidate cache liên quan đến `book_id` đó nếu muốn consistency chặt hơn.
- Đo hit/miss ratio, log lại làm minh chứng hiệu quả cache trong báo cáo.

## 8. Backup & Audit

- `pg_dump`/restore: xem spec mục 8.
- `audit_log`: JSONB `old_data`/`new_data`, ghi qua trigger, phục vụ truy vết thay đổi.

## 9. Kết quả thực nghiệm

Xem [BENCHMARKS.md](BENCHMARKS.md) — đã có kết quả cho: test concurrency (10 request song song, đúng 1 thành công), EXPLAIN ANALYZE trước/sau `idx_books_search`, và xác nhận cache-aside hoạt động.
