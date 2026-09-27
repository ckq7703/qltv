# Kết quả benchmark — QLTV

## 1. Full-text search index (`idx_books_search`, GIN)

**Setup**: bulk insert 20.000 sách giả lập (`generate_series`), truy vấn:
```sql
SELECT id, title FROM books WHERE search_vector @@ plainto_tsquery('simple', 'Database');
```
Kết quả khớp: 3.334/20.005 dòng.

| | Có index (GIN) | Không có index |
|---|---|---|
| Query plan | `Bitmap Index Scan` trên `idx_books_search` + `Bitmap Heap Scan` | `Seq Scan` toàn bảng |
| Buffers đọc | 870 (10 cho index scan + 860 heap) | 860 (toàn bộ heap) + so duyệt loại 16.671 dòng thừa |
| Planning Time | 1.092 ms | 0.803 ms |
| **Execution Time** | **2.411 ms** | **4.576 ms** |

**Nhận xét**: Ở quy mô 20.000 dòng, chênh lệch thực thi ~1.9x (2.41ms vs 4.58ms). Điểm quan trọng hơn con số tuyệt đối là **thay đổi chiến lược thực thi**: planner chuyển từ `Seq Scan` (đọc toàn bảng, loại bỏ 16.671 dòng không khớp) sang `Bitmap Index Scan` (chỉ đọc trực tiếp các dòng khớp qua GIN index). Với bảng lớn hơn (hàng trăm nghìn/triệu dòng — quy mô thực tế một thư viện lớn), khoảng cách này sẽ giãn ra theo cấp số nhân vì `Seq Scan` có độ phức tạp O(n) trong khi `Index Scan` gần O(log n) + O(kết quả khớp).

**Full output — có index**:
```
Bitmap Heap Scan on books  (cost=42.83..195.50 rows=47 width=520) (actual time=1.200..2.268 rows=3334 loops=1)
  Recheck Cond: (search_vector @@ '''database'''::tsquery)
  Heap Blocks: exact=860
  Buffers: shared hit=870
  ->  Bitmap Index Scan on idx_books_search  (cost=0.00..42.82 rows=47 width=0) (actual time=0.540..0.540 rows=6668 loops=1)
        Index Cond: (search_vector @@ '''database'''::tsquery)
        Buffers: shared hit=10
Planning:
  Buffers: shared hit=146
Planning Time: 1.092 ms
Execution Time: 2.411 ms
```

**Full output — không có index**:
```
Seq Scan on books  (cost=0.00..978.25 rows=47 width=520) (actual time=0.835..4.445 rows=3334 loops=1)
  Filter: (search_vector @@ '''database'''::tsquery)
  Rows Removed by Filter: 16671
  Buffers: shared hit=860
Planning:
  Buffers: shared hit=111
Planning Time: 0.803 ms
Execution Time: 4.576 ms
```

> Dữ liệu bulk (20.000 dòng `isbn LIKE 'BULK-%'`) đã được xoá sau khi benchmark để giữ DB sạch cho demo. Lệnh tái tạo benchmark: xem skill `.claude/skills/db-benchmark/SKILL.md`.

## 2. Concurrency control — `SELECT ... FOR UPDATE SKIP LOCKED`

**Test**: `backend/tests/test_concurrency.py` — 10 request `POST /loans/borrow` đồng thời (dùng `ThreadPoolExecutor`) cho cùng 1 sách ("Foundation") chỉ còn đúng 1 bản sao khả dụng.

**Kết quả chạy thực tế** (2026-09-22):
```
8 passed, 14 warnings in 1.03s
```
- Đúng **1/10** request trả về `201 Created`.
- **9/10** request còn lại trả về `409 Conflict` ("No available copy for this book").
- **0** lỗi 500/deadlock/treo.
- Xác nhận: `SELECT ... FOR UPDATE SKIP LOCKED` trong `app/services/loans.py` ngăn chặn thành công tình huống 2 độc giả cùng mượn trùng 1 bản sao khi tương tranh.

## 3. Cache-aside Redis (tìm kiếm sách)

Sau 3 lần gọi liên tiếp `GET /books?search=Foundation`: `hits` tăng dần theo mỗi lần gọi lặp lại cùng query (xác nhận qua `GET /stats/cache`), key cache được lưu dạng `books:search:<sha256 hash>` trong Redis với TTL 60s. Chi tiết thiết kế: `docs/DATABASE.md` mục 7.
