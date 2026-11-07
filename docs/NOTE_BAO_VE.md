# Note nhanh để bảo vệ đồ án QLTV

> Ghi chú cá nhân cho người trình bày, tổng hợp từ code thực tế (không phải từ PLAN.md). Có mục "điểm yếu thật của code" để bạn tự nói trước khi bị hỏi.

## 1. Một câu mô tả dự án
Hệ thống quản lý thư viện. Trọng tâm là **tầng CSDL PostgreSQL**: schema chuẩn hóa, chống mượn trùng bằng khóa dòng, trigger, view, index, cache Redis. UI và API chỉ để chứng minh phần DB chạy đúng.

## 2. Kiến trúc (4 container)
| Thành phần | Vai trò |
|---|---|
| PostgreSQL 16 | Dữ liệu, trigger, view, index, transaction |
| Redis 7 | (1) cache tìm kiếm sách, (2) lưu refresh token, (3) Pub/Sub thông báo realtime |
| FastAPI (`backend/`) | Router mỏng, logic nằm ở `services/`, SQLAlchemy 2.0 + Alembic |
| React + Vite (`frontend/`) | Gọi API qua proxy `/api`, `/ws` |

Luồng: Browser → Vite proxy → FastAPI → Postgres/Redis. Không có NestJS (Phase 11 tùy chọn, chưa làm).

## 3. Schema (9 bảng, migration `0001`)
- `authors`, `categories` (cây: `parent_id` tự tham chiếu), `books`, `book_authors` (n-n, PK ghép), `book_copies`, `members`, `loans`, `users`, `audit_log`.
- **Quyết định chính**: tách `book_copies` (mỗi cuốn vật lý = 1 dòng) thay vì cột `available_copies` trên `books`. Lý do: khóa được đúng 1 dòng cụ thể; số "còn lại" là dữ liệu dẫn xuất (COUNT), không lưu, nên không bị lệch.
- Chuẩn hóa: tác giả/thể loại tách riêng (2NF/3NF), n-n qua bảng nối.
- Ràng buộc: `CHECK` trạng thái bản sao (`available/borrowed/lost/damaged`), `CHECK returned_at >= borrowed_at`, `CHECK role IN ('admin','member')`, `UNIQUE` isbn/email/username, FK `ON DELETE CASCADE` cho `book_copies`, `book_authors`.
- `loans.returned_at IS NULL` = đang mượn (không có cột status riêng, trạng thái suy ra).
- `users.member_id` nullable: admin không có hồ sơ độc giả.
- `0005` thêm `members.avatar_url`; `0006` thêm index cho `audit_log` + hàm audit mới có `changed_by`.

## 4. Mượn sách + chống tương tranh (phần quan trọng nhất)
File: [backend/app/services/loans.py](../backend/app/services/loans.py)

```
BEGIN
  SELECT id FROM book_copies WHERE book_id=? AND status='available'
  LIMIT 1 FOR UPDATE SKIP LOCKED          -- khóa 1 bản sao rảnh
  (không có -> 409)
  COUNT loans chưa trả của member >= 3 -> 409
  INSERT loans (due_date = now + 14 ngày)
  -- trigger trg_after_loan_insert: copy.status='borrowed', version+1
COMMIT   (lỗi -> rollback nhả khóa)
sau commit: xóa cache tìm kiếm
```
- **Vì sao SKIP LOCKED**: giao dịch khác không chờ mà bỏ qua dòng đang bị khóa, lấy bản sao rảnh khác. Độc giả không quan tâm mượn bản sao nào.
- **Isolation**: READ COMMITTED (mặc định) là đủ khi đi kèm FOR UPDATE.
- **Test**: [test_concurrency.py](../backend/tests/test_concurrency.py): 10 thread cùng mượn sách còn 1 bản → đúng 1 `201`, 9 `409`, 0 lỗi 500.
- **Optimistic locking** (`book_copies.version`): chỉ là phương án so sánh trong báo cáo. Cột `version` có và được trigger tăng, nhưng **code ứng dụng không dùng nó để kiểm tra** (đừng nói là đã triển khai).
- Trả sách ([return_book](../backend/app/services/loans.py)): set `returned_at`, trigger `trg_after_loan_return` đưa bản sao về `available`. Phiếu không có → 404, đã trả → 409.
- Phân quyền: admin mượn hộ (phải gửi `member_id`); member **luôn mượn cho chính mình**, `member_id` trong body bị bỏ qua, lấy từ JWT ([routers/loans.py](../backend/app/routers/loans.py)). Có test chống giả mạo.

## 5. Trigger (migration `0002`, `0004`, `0006`)
| Trigger | Sự kiện | Việc làm |
|---|---|---|
| `trg_after_loan_insert` | AFTER INSERT loans | copy → `borrowed`, version+1 |
| `trg_after_loan_return` | AFTER UPDATE loans | nếu `returned_at` từ NULL sang có giá trị: copy → `available`, version+1 |
| `trg_audit_books`, `trg_audit_loans` | AFTER INSERT/UPDATE/DELETE | ghi `audit_log` (JSONB `to_jsonb(OLD/NEW)`) |
| `trg_books_search_vector_update` | BEFORE INSERT/UPDATE OF title | cập nhật `search_vector` (`to_tsvector('simple', title)`) |

**Vì sao đồng bộ trạng thái bằng trigger**: mọi đường ghi vào `loans` (API, script, SQL tay) đều giữ `book_copies` nhất quán, không phụ thuộc app.

**`changed_by` trong audit** ([deps.py](../backend/app/deps.py), migration `0006`): dependency `audited_claims` chạy `set_config('app.user_id', <id>, true)` (tham số `true` = chỉ sống trong transaction hiện tại, không rò sang request khác qua connection pool). Trigger đọc `current_setting('app.user_id', true)`, `NULLIF(...,'')` vì Postgres trả chuỗi rỗng thay vì NULL sau khi biến local hết hạn. Thay đổi không qua API (seed, SQL tay) → `changed_by = NULL`. Chỉ audit `books` và `loans`.

## 6. View / Materialized View (migration `0003`)
- `v_top_borrowed_books`: `RANK()` (đồng hạng thì nhảy bậc).
- `v_active_members`: `DENSE_RANK()` (đồng hạng không nhảy bậc). Hai view cố ý dùng 2 hàm khác nhau để so sánh.
- `v_overdue_loans`: chưa trả và `due_date < now()`, tính động; `overdue_by = now() - due_date`. `GET /loans?status=overdue` đọc từ view này.
- `mv_monthly_stats`: tổng mượn theo tháng; **phải refresh thủ công** (`POST /stats/refresh-monthly`).
- Cả hai view xếp hạng dùng `JOIN` thường nên sách/độc giả **chưa từng được mượn không xuất hiện**.

## 7. Index (migration `0004`) + benchmark
| Index | Dùng cho |
|---|---|
| `idx_books_search` GIN trên `search_vector` | full-text search |
| `idx_books_category` | lọc theo thể loại |
| `idx_copies_book_status (book_id, status)` | tìm bản sao rảnh khi mượn |
| `idx_loans_member` | phiếu theo độc giả |
| `idx_loans_open` partial `WHERE returned_at IS NULL` | phiếu đang mượn, index nhỏ |
| `idx_audit_log_changed_at`, `idx_audit_log_table_row` | trang Audit Log |

Benchmark ([BENCHMARKS.md](BENCHMARKS.md)): 20.000 sách giả lập, tìm "Database": `Seq Scan` 4.576 ms → `Bitmap Index Scan` 2.411 ms (~1.9x). Nói thẳng: ở quy mô này chênh lệch nhỏ, **điểm chính là planner đổi chiến lược** (O(n) → gần O(log n) + số kết quả khớp). Dữ liệu bulk đã xóa sau khi đo.

## 8. Cache Redis (cache-aside) — [books_cache.py](../backend/app/cache/books_cache.py)
- Chỉ cache `GET /books`. Key = `books:search:<sha256 của mọi tham số: search, category, available_only, sort, page...>`; TTL 60 giây.
- Hit: trả luôn. Miss: query DB, `SET` với TTL. Đếm hit/miss bằng `INCR`, xem ở `GET /stats/cache`.
- **Invalidate chủ động** sau mọi thao tác ghi qua API (mượn, trả, tạo/sửa/xóa sách, đổi trạng thái bản sao): dùng `SCAN` + `DELETE` theo prefix (không dùng `KEYS` vì chặn Redis). TTL 60s là lưới an toàn.
- Trade-off: eventual consistency, liên hệ CAP.

## 9. Auth — [services/auth.py](../backend/app/services/auth.py), [security.py](../backend/app/security.py)
- bcrypt băm mật khẩu. Access token = JWT HS256, 30 phút, claims: `sub`, `role`, `member_id`, `exp`, `type`.
- Refresh token = `uuid4().hex` lưu Redis `refresh_token:<token>` → user_id, TTL 7 ngày. **Rotation**: mỗi lần refresh xóa token cũ, phát token mới. Logout = xóa key Redis.
- Login sai tên hay sai mật khẩu trả cùng 1 thông báo (không lộ tài khoản nào tồn tại).
- Frontend ([api.ts](../frontend/src/lib/api.ts)): interceptor axios gặp 401 thì refresh rồi retry đúng 1 lần (`_retry`); nhiều request cùng 401 chỉ gọi refresh 1 lần (`refreshPromise` dùng chung). Role đọc từ JWT chỉ để vẽ UI, không kiểm chữ ký; backend mới là nơi kiểm thật.
- Tài khoản demo seed: `admin/admin123`, `vana/member123` (mỗi member một user).

## 10. Realtime thông báo
Member tự mượn → backend `PUBLISH` vào kênh Redis `notifications:admin` → WebSocket `/ws/notifications?token=` (chỉ admin; sai token đóng 4401, không phải admin đóng 4403) → toast + chuông ở UI. Dùng client Redis **async** riêng để không chặn event loop. Handler chạy 2 task song song (forward message, canh client ngắt kết nối); thiếu task canh disconnect thì handler treo và uvicorn không reload được.

## 11. API (tóm tắt)
`/auth/{login,refresh,logout,me}`, `/books` (list/CRUD, `/{id}/copies` thêm/liệt kê, `PATCH /{id}/copies/{copy_id}` đổi trạng thái lost/damaged/available), `/authors`, `/categories`, `/members`, `/loans` (`/policy`, `/borrow`, `/{id}/return`, `/{id}`, list có lọc/phân trang), `/stats/{top-books,active-members,refresh-monthly,cache}`, `/uploads/cover`, `/audit-logs`, `/ws/notifications`, `/health`.

Điểm hay bị hỏi:
- Xóa sách đã có lịch sử mượn → `409` (giữ audit trail). Không xóa bản sao để giảm số lượng, đổi trạng thái sang lost/damaged.
- Không cho đổi trạng thái bản sao đang `borrowed` (do trigger quản lý).
- Upload ảnh bìa: chỉ png/jpeg/webp/gif, tối đa 5MB, tên file uuid.
- Nội quy: 14 ngày, tối đa 3 phiếu chưa trả, phạt 5.000 VND/ngày (**chỉ hiển thị**, chưa có thanh toán).

## 12. Frontend (React 19 + Vite + TS + Tailwind v4 + shadcn/ui bản base-ui)
Route: `/` Books và `/login` công khai; `/my-loans` cần đăng nhập (`RequireAuth`); `/members`, `/categories`, `/loans`, `/audit-log`, `/stats` chỉ admin (`AdminRoute`). Điểm đáng nhớ: `BorrowWizard` (mượn 3 bước), `LoanDetailDialog`, `NotificationBell`, `PaginationBar` dùng chung. Form viết tay bằng `useState`, không dùng react-hook-form. UI tiếng Anh, layout sidebar.

## 13. Điểm yếu thật của code (tự nói trước, đừng để bị bắt)
1. **Hạn mức 3 phiếu không được khóa**: 2 request đồng thời của *cùng một member* có thể cùng qua bước COUNT rồi cùng INSERT, vượt quá 3. Sách thì được khóa, member thì không (code có ghi chú này). Cách sửa: khóa dòng `members` (`SELECT ... FOR UPDATE`) hoặc advisory lock theo `member_id` trước khi đếm.
2. **SKIP LOCKED có thể báo "hết sách" sai**: nếu bản sao cuối đang bị giao dịch khác khóa, giao dịch này nhận 409 ngay, dù giao dịch kia sau đó rollback (vd vượt hạn mức) và bản sao lại rảnh. Đánh đổi chấp nhận được của SKIP LOCKED (nhanh, không chờ, không deadlock).
3. **`GET /books` không tối ưu**: nạp toàn bộ sách khớp vào Python, gọi 2 câu COUNT cho mỗi sách (N+1), rồi lọc `available_only`, sắp xếp, phân trang bằng Python. Cache che đi vấn đề này nhưng với dữ liệu lớn phải chuyển sang SQL (subquery/GROUP BY + `LIMIT/OFFSET`).
4. **Một số endpoint không cần đăng nhập**: `GET /members` (lộ email/SĐT), toàn bộ `/stats/*`, kể cả `POST /stats/refresh-monthly`. Code có ghi chú; nên nói đây là hạn chế đã biết.
5. **Logout không thu hồi access token** (sống tới hết 30 phút); token lưu `localStorage` (rủi ro XSS); token WebSocket đi qua query string (có thể lộ trong log).
6. **`mv_monthly_stats` chưa được API nào đọc**, chỉ có nút refresh. Refresh không dùng `CONCURRENTLY` (cần unique index) nên khóa đọc trong lúc refresh.
7. **`version` (optimistic locking) chưa dùng** như đã nói ở mục 4.
8. **Audit chỉ phủ `books` và `loans`**; `book_copies`, `members` không có. Thay đổi trạng thái bản sao do admin đổi tay không vào audit.
9. **Cache invalidate chỉ qua API**: ghi trực tiếp bằng SQL (hoặc seed) không xóa cache, tối đa lệch 60s do TTL.
10. **Chưa làm**: backup/PITR (Phase 10), NestJS gateway (Phase 11), RLS thật (chỉ phân quyền ở tầng app), phí phạt thật.
11. Test là integration test chạy thẳng vào DB của docker-compose (không mock), cần stack đang chạy và đã seed. Số test thực tế đếm được: **18** (audit 3, books 4, concurrency 1, loans 4, member self-service 6). `CLAUDE.md` còn ghi "8/8", `PLAN.md` ghi "15/15": cả hai đã cũ.

## 14. Câu hỏi cô có thể hỏi + hướng trả lời
- **Vì sao không dùng `SERIALIZABLE`?** READ COMMITTED + `FOR UPDATE` khóa đúng dòng cần tranh chấp, rẻ hơn; SERIALIZABLE có thể ném lỗi serialization buộc app retry.
- **Vì sao không đếm `available_copies` trên `books`?** Dễ lệch khi tương tranh, mất truy vết từng cuốn; xem mục 3.
- **Nếu bỏ `FOR UPDATE` thì sao?** Hai giao dịch cùng SELECT thấy bản sao `available`, cùng INSERT loan → mượn trùng. Có thể nói test chứng minh được phía ngược lại (đúng 1/10).
- **Pessimistic vs optimistic?** Pessimistic: khóa trước, hợp khi xung đột cao (sách hot). Optimistic: `UPDATE ... WHERE version = :v`, 0 dòng bị ảnh hưởng → retry; hợp khi ít xung đột. Ở đây chọn pessimistic vì tranh chấp thật sự dồn vào vài bản sao.
- **Trigger vs xử lý ở app?** Trigger đảm bảo nhất quán bất kể đường ghi; nhược điểm là logic "ẩn", khó debug và test.
- **View thường vs materialized?** View tính lại mỗi lần (luôn mới); MV lưu sẵn (nhanh, nhưng cũ cho tới khi refresh).
- **Partial index lợi gì?** Chỉ index phiếu chưa trả: nhỏ hơn, nhanh hơn cho truy vấn thường gặp nhất.
- **Vì sao dùng `'simple'` cho tsvector?** Không stem/stopword theo ngôn ngữ, phù hợp tiêu đề lẫn tiếng Việt/Anh; đánh đổi: không tìm theo gốc từ.
- **Cache-aside vs write-through?** Cache-aside: app tự đọc/ghi cache, đơn giản, chịu được Redis chết (về lý thuyết); xem CAP/eventual consistency.
- **`set_config(..., true)` để làm gì?** Truyền user id vào trigger, tự hết hiệu lực khi hết transaction, an toàn với connection pool.
- **Reproduce DB từ đầu?** `alembic upgrade head` (trigger/view/index đều trong migration, đúng quy ước dự án), rồi `python -m app.seed` (idempotent nhờ `get_or_create`).

## 15. Chạy demo
`docker compose up -d` (postgres, redis, backend :8000, frontend :5173) → `alembic upgrade head` → `python -m app.seed` → `pytest` (cần stack đang chạy). Swagger tại `http://localhost:8000/docs`. Kịch bản demo gợi ý: (1) mở 2 trình duyệt, member mượn sách, admin thấy thông báo realtime; (2) chạy `pytest tests/test_concurrency.py`; (3) sửa sách rồi mở trang Audit Log xem `old_data/new_data` và người sửa; (4) `EXPLAIN ANALYZE` truy vấn full-text.

## 16. Bản đồ file đáng đọc kỹ (theo thứ tự ưu tiên)
1. [services/loans.py](../backend/app/services/loans.py) — khóa tương tranh
2. [migrations/versions/0002_triggers.py](../backend/migrations/versions/0002_triggers.py), [0006](../backend/migrations/versions/0006_audit_changed_by.py)
3. [0003_views.py](../backend/migrations/versions/0003_views.py), [0004_indexes.py](../backend/migrations/versions/0004_indexes.py)
4. [routers/loans.py](../backend/app/routers/loans.py), [routers/books.py](../backend/app/routers/books.py)
5. [cache/books_cache.py](../backend/app/cache/books_cache.py), [deps.py](../backend/app/deps.py), [services/auth.py](../backend/app/services/auth.py)
6. [tests/test_concurrency.py](../backend/tests/test_concurrency.py), [docs/BAOCAO_DO_AN.md](BAOCAO_DO_AN.md)
