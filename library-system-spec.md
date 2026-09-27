# Hệ Thống Quản Lý Thư Viện / Mượn Sách Mini
### Đề tài môn Hệ Cơ Sở Dữ Liệu (Thạc sĩ) — trọng tâm thiết kế & vận hành CSDL

## 1. Tổng quan

Ứng dụng quản lý thư viện quy mô nhỏ, cho phép quản trị viên (thủ thư) quản lý đầu sách, độc giả và theo dõi việc mượn/trả sách. Vì đây là đề tài môn CSDL, **trọng tâm không phải là số lượng tính năng nghiệp vụ mà là chiều sâu thiết kế và vận hành tầng dữ liệu**: chuẩn hóa lược đồ, kiểm soát tương tranh (concurrency control), transaction, index/tối ưu truy vấn, trigger/stored procedure/view, cache và audit log.

**Kiến trúc (tối giản, dồn công sức vào tầng dữ liệu):**
```
┌──────────────────┐      REST/HTTP       ┌──────────────────┐
│   Web/API Client  │ ───────────────────► │  Backend (FastAPI)│
│  (tuỳ chọn: NestJS│                      │  Business Logic   │
│  làm BFF mỏng)    │ ◄─────────────────── │                    │
└──────────────────┘                      └─────────┬─────────┘
                                                      │
                                          ┌───────────┴───────────┐
                                          │                       │
                                    ┌─────▼─────┐         ┌───────▼──────┐
                                    │ PostgreSQL │         │    Redis     │
                                    │ (dữ liệu)  │         │ (cache/session)│
                                    └────────────┘         └──────────────┘
```

> Ghi chú kiến trúc: Nếu môn học không bắt buộc microservice, nên **bỏ tầng NestJS** và chỉ dùng FastAPI làm backend duy nhất, để tập trung thời gian vào thiết kế CSDL — phần được chấm điểm chính. Nếu vẫn cần giữ NestJS (theo yêu cầu đề bài khác), nó chỉ đóng vai trò gateway mỏng (xác thực JWT + forward request), không chứa business logic và không có DB riêng.

---

## 2. Danh sách tính năng

### 2.1. Quản lý sách (Book Management)
- [ ] CRUD đầu sách: tên, ISBN, số lượng, ảnh bìa, tác giả (m:n), thể loại (n:1 hoặc m:n)
- [ ] Tìm kiếm sách theo tên/tác giả/thể loại — dùng **PostgreSQL full-text search** (`tsvector` + index GIN), cache kết quả bằng Redis
- [ ] Theo dõi số lượng còn lại (available copies) real-time — tính từ bảng `book_copies`, đồng bộ qua **trigger**, không tính tay ở tầng application
- [ ] Phân loại sách theo thể loại/kệ sách

### 2.2. Quản lý độc giả (Member Management)
- [ ] CRUD thông tin độc giả: họ tên, email, SĐT, ngày đăng ký
- [ ] Giới hạn số sách được mượn cùng lúc (VD: tối đa 3 cuốn) — kiểm tra bằng constraint/transaction, không chỉ ở tầng code
- [ ] Lịch sử mượn/trả của từng độc giả

### 2.3. Mượn / Trả sách (Borrowing) — trọng tâm concurrency control
- [ ] Tạo phiếu mượn: chọn độc giả + chọn 1 bản sao sách cụ thể (`book_copy`), tự tính hạn trả (VD: 14 ngày)
- [ ] **Xử lý tương tranh**: 2 độc giả cùng mượn cuốn cuối cùng tại cùng thời điểm → dùng transaction với `SELECT ... FOR UPDATE` (pessimistic locking) hoặc cột `version` (optimistic locking) để đảm bảo không mượn trùng
- [ ] Xác nhận trả sách, trigger tự động cập nhật trạng thái bản sao + `available_copies`
- [ ] Cảnh báo/đánh dấu sách quá hạn (overdue) — tính **on-the-fly** từ `due_date` (view), không cần job nền
- [ ] (Tuỳ chọn) Tính phí phạt trễ hạn — có thể triển khai bằng stored function

### 2.4. Xác thực & phân quyền
- [ ] Đăng nhập (JWT), refresh token lưu ở Redis
- [ ] Phân quyền: Admin (thủ thư) vs Member (độc giả tự tra cứu) — cân nhắc minh họa thêm **Row-Level Security (RLS)** của PostgreSQL để Member chỉ thấy dữ liệu mượn của chính mình

### 2.5. Thống kê & báo cáo (trọng tâm SQL nâng cao)
- [ ] View `v_top_borrowed_books`: sách được mượn nhiều nhất (dùng `GROUP BY` + `RANK()`)
- [ ] View `v_overdue_loans`: phiếu quá hạn, tính động từ `due_date < now()`
- [ ] View `v_active_members`: độc giả hoạt động nhiều nhất (window function)
- [ ] Materialized view `mv_monthly_stats` cho báo cáo theo tháng, minh họa `REFRESH MATERIALIZED VIEW`
- [ ] (Tuỳ chọn) CTE đệ quy nếu mở rộng thể loại sách theo cây phân cấp (category → subcategory)

### 2.6. Audit & vận hành CSDL (bổ sung cho đề tài học thuật)
- [ ] Bảng `audit_log` ghi lại thay đổi trên `books`, `loans` qua **trigger** (`AFTER INSERT/UPDATE/DELETE`)
- [ ] Chiến lược backup/recovery: `pg_dump` định kỳ + minh họa point-in-time recovery (PITR) bằng WAL
- [ ] Redis: minh họa **cache-aside pattern**, TTL, chiến lược invalidate khi `books`/`available_copies` thay đổi; đo lường cache hit/miss ratio

---

## 3. Công nghệ sử dụng

| Thành phần         | Công nghệ                              | Vai trò |
|---------------------|------------------------------------------|---------|
| API Gateway / BFF (tuỳ chọn) | **NestJS** (TypeScript)         | Nếu giữ: chỉ xác thực JWT + forward xuống backend Python, không chứa business logic |
| Backend nghiệp vụ   | **Python (FastAPI)**                     | Xử lý logic mượn/trả, CRUD sách/độc giả, gọi stored procedure khi cần |
| Database            | **PostgreSQL**                           | Lưu trữ dữ liệu chính; nơi triển khai transaction, trigger, view, index — trọng tâm đề tài |
| Cache/Session       | **Redis**                                | Cache kết quả tìm kiếm (cache-aside), lưu refresh token, rate limiting |
| ORM (Python)        | SQLAlchemy + Alembic (migration)         | |
| Container           | **Docker & Docker Compose**              | Đóng gói và chạy toàn bộ hệ thống |
| API Docs            | FastAPI tự sinh Swagger (`/docs`)        | |

---

## 4. Thiết kế database (chuẩn hóa đến 3NF)

```sql
-- authors: tách riêng để tránh lặp dữ liệu tên tác giả (chuẩn hóa 2NF/3NF)
CREATE TABLE authors (
    id          SERIAL PRIMARY KEY,
    full_name   VARCHAR(255) NOT NULL
);

-- categories: hỗ trợ phân cấp thể loại (self-reference cho subcategory)
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    parent_id   INTEGER REFERENCES categories(id)
);

-- books: thông tin đầu sách (title, KHÔNG lưu author/category trực tiếp)
CREATE TABLE books (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    isbn         VARCHAR(20) NOT NULL UNIQUE,
    category_id  INTEGER REFERENCES categories(id),
    cover_url    TEXT,
    search_vector tsvector,          -- full-text search index
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_books_search ON books USING GIN (search_vector);
CREATE INDEX idx_books_category ON books (category_id);

-- book_authors: quan hệ n:n giữa books và authors
CREATE TABLE book_authors (
    book_id     INTEGER REFERENCES books(id) ON DELETE CASCADE,
    author_id   INTEGER REFERENCES authors(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, author_id)
);

-- book_copies: mỗi cuốn sách vật lý là 1 row → thay cho total_copies/available_copies thô
CREATE TABLE book_copies (
    id          SERIAL PRIMARY KEY,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'available'
                CHECK (status IN ('available', 'borrowed', 'lost', 'damaged')),
    version     INTEGER NOT NULL DEFAULT 0        -- optimistic locking (nếu không dùng SELECT FOR UPDATE)
);
CREATE INDEX idx_copies_book_status ON book_copies (book_id, status);

-- members
CREATE TABLE members (
    id          SERIAL PRIMARY KEY,
    full_name   VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    phone       VARCHAR(20),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- loans: phiếu mượn gắn với 1 bản sao cụ thể (không phải book_id chung chung)
CREATE TABLE loans (
    id            SERIAL PRIMARY KEY,
    book_copy_id  INTEGER NOT NULL REFERENCES book_copies(id),
    member_id     INTEGER NOT NULL REFERENCES members(id),
    borrowed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_date      TIMESTAMPTZ NOT NULL,
    returned_at   TIMESTAMPTZ,
    CONSTRAINT chk_return_after_borrow CHECK (returned_at IS NULL OR returned_at >= borrowed_at)
);
CREATE INDEX idx_loans_member ON loans (member_id);
CREATE INDEX idx_loans_open ON loans (book_copy_id) WHERE returned_at IS NULL;

-- users: tách khỏi members, có thể liên kết đến 1 member khi role = 'member'
CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    username       VARCHAR(100) NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    role           VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member')),
    member_id      INTEGER REFERENCES members(id)
);

-- audit_log: ghi lại thay đổi qua trigger
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    table_name  VARCHAR(50) NOT NULL,
    operation   VARCHAR(10) NOT NULL,
    row_id      INTEGER,
    changed_by  VARCHAR(100),
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    old_data    JSONB,
    new_data    JSONB
);
```

### 4.1. Trigger minh họa: tự động cập nhật trạng thái bản sao khi mượn/trả
```sql
CREATE OR REPLACE FUNCTION fn_after_loan_insert() RETURNS TRIGGER AS $$
BEGIN
    UPDATE book_copies SET status = 'borrowed', version = version + 1
    WHERE id = NEW.book_copy_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_loan_insert
AFTER INSERT ON loans
FOR EACH ROW EXECUTE FUNCTION fn_after_loan_insert();

CREATE OR REPLACE FUNCTION fn_after_loan_return() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.returned_at IS NOT NULL AND OLD.returned_at IS NULL THEN
        UPDATE book_copies SET status = 'available', version = version + 1
        WHERE id = NEW.book_copy_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_loan_return
AFTER UPDATE ON loans
FOR EACH ROW EXECUTE FUNCTION fn_after_loan_return();
```

### 4.2. Views cho thống kê
```sql
CREATE VIEW v_top_borrowed_books AS
SELECT b.id, b.title, COUNT(l.id) AS times_borrowed,
       RANK() OVER (ORDER BY COUNT(l.id) DESC) AS rank
FROM books b
JOIN book_copies bc ON bc.book_id = b.id
JOIN loans l ON l.book_copy_id = bc.id
GROUP BY b.id, b.title;

CREATE VIEW v_overdue_loans AS
SELECT l.id, l.member_id, bc.book_id, l.due_date,
       now() - l.due_date AS overdue_by
FROM loans l
JOIN book_copies bc ON bc.id = l.book_copy_id
WHERE l.returned_at IS NULL AND l.due_date < now();

CREATE VIEW v_active_members AS
SELECT m.id, m.full_name, COUNT(l.id) AS total_loans,
       DENSE_RANK() OVER (ORDER BY COUNT(l.id) DESC) AS activity_rank
FROM members m
JOIN loans l ON l.member_id = m.id
GROUP BY m.id, m.full_name;

-- materialized view: báo cáo theo tháng, minh họa REFRESH định kỳ
CREATE MATERIALIZED VIEW mv_monthly_stats AS
SELECT date_trunc('month', borrowed_at) AS month,
       COUNT(*) AS total_loans,
       COUNT(*) FILTER (WHERE returned_at IS NULL) AS still_borrowed
FROM loans
GROUP BY 1;
```

### 4.3. Transaction mẫu cho nghiệp vụ mượn sách (pessimistic locking)
```sql
BEGIN;
-- Khóa bản sao còn trống của sách để tránh 2 giao dịch cùng chọn 1 bản sao
SELECT id FROM book_copies
WHERE book_id = :book_id AND status = 'available'
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- Kiểm tra giới hạn mượn (VD: tối đa 3 cuốn/độc giả) trong cùng transaction
SELECT COUNT(*) FROM loans
WHERE member_id = :member_id AND returned_at IS NULL;

INSERT INTO loans (book_copy_id, member_id, due_date)
VALUES (:book_copy_id, :member_id, now() + interval '14 days');

COMMIT;
```
> Đây là nội dung nên trình bày kỹ trong báo cáo: so sánh `FOR UPDATE` (pessimistic) với cột `version` (optimistic locking), giải thích trade-off và benchmark thử với công cụ giả lập tải đồng thời (VD: `pgbench` hoặc script Python bắn request song song).

---

## 5. API chính (ví dụ, do Python backend cung cấp)

```
POST   /auth/login
POST   /auth/refresh

GET    /books?search=&category=
POST   /books
PUT    /books/{id}
DELETE /books/{id}

GET    /members
POST   /members

POST   /loans/borrow      { book_id, member_id }   -- backend tự chọn 1 book_copy khả dụng trong transaction
POST   /loans/{id}/return
GET    /loans?status=overdue                        -- đọc từ view v_overdue_loans

GET    /stats/top-books        -- đọc từ v_top_borrowed_books
GET    /stats/active-members   -- đọc từ v_active_members
```

---

## 6. Chỉ mục & tối ưu truy vấn (nội dung báo cáo)

- Đánh index cho các cột tìm kiếm/join thường xuyên: `idx_books_search` (GIN, full-text), `idx_books_category`, `idx_loans_member`, `idx_copies_book_status`, partial index `idx_loans_open` (chỉ index các phiếu chưa trả — giảm kích thước index).
- Trước/sau khi thêm index, chạy `EXPLAIN (ANALYZE, BUFFERS)` cho truy vấn tìm kiếm sách và truy vấn `v_overdue_loans` để so sánh chi phí (seq scan → index scan), đưa vào báo cáo làm minh chứng thực nghiệm.
- Với bảng `loans` khi dữ liệu lớn dần theo thời gian, có thể bàn thêm về **table partitioning theo `borrowed_at`** (range partition theo năm/tháng) như một hướng mở rộng lý thuyết, dù không bắt buộc triển khai với quy mô dữ liệu nhỏ của đồ án.

---

## 7. Cache Redis (cache-aside pattern)

- Khi `GET /books?search=...`: kiểm tra Redis trước (key = hash của query params), nếu miss thì query PostgreSQL rồi set cache với TTL (VD: 60s).
- Khi có `POST/PUT/DELETE /books` hoặc khi trigger cập nhật `book_copies.status`: invalidate các cache key liên quan (hoặc dùng TTL ngắn thay vì invalidate chủ động, tuỳ mức độ chấp nhận dữ liệu cũ — nên bàn trade-off này trong báo cáo, liên hệ CAP theorem/eventual consistency).
- Đo lường và báo cáo **cache hit/miss ratio** để chứng minh hiệu quả cache.
- Refresh token: lưu trong Redis với TTL = thời hạn refresh token, hỗ trợ revoke khi logout.

---

## 8. Backup, Recovery & Audit

- Backup định kỳ bằng `pg_dump`; minh họa khôi phục từ file dump.
- (Tuỳ chọn nâng cao) Cấu hình WAL archiving để minh họa Point-in-Time Recovery (PITR).
- Trigger ghi `audit_log` cho các thao tác trên `books` và `loans`, phục vụ truy vết và minh họa kỹ thuật temporal/audit data trong CSDL.

---

## 9. Docker Compose

Xem file `docker-compose.yml` đính kèm. Cấu trúc thư mục đề xuất:

```
library-system/
├── docker-compose.yml
├── backend/            # Python FastAPI
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── migrations/     # Alembic: chứa migration cho schema chuẩn hóa + trigger/view
│   └── app/
├── gateway/             # NestJS (tuỳ chọn, chỉ nếu cần BFF)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
└── .env
```

---

## 10. Checklist triển khai (gợi ý thứ tự làm)

- [ ] Bước 1: Dựng docker-compose (Postgres + Redis) chạy được trước
- [ ] Bước 2: Thiết kế & migrate schema chuẩn hóa (authors, categories, books, book_authors, book_copies, members, loans, users, audit_log)
- [ ] Bước 3: Viết trigger đồng bộ `book_copies.status` khi mượn/trả + trigger audit_log
- [ ] Bước 4: Viết API mượn/trả sách với transaction xử lý tương tranh (`FOR UPDATE SKIP LOCKED` hoặc optimistic locking)
- [ ] Bước 5: Viết views/materialized view cho thống kê + API đọc từ views
- [ ] Bước 6: Thêm auth JWT + Redis cho refresh token
- [ ] Bước 7: Thêm cache tìm kiếm sách bằng Redis (cache-aside) + đo hit/miss
- [ ] Bước 8: Đánh index + benchmark `EXPLAIN ANALYZE` trước/sau
- [ ] Bước 9: Viết kịch bản test concurrency (2 request mượn cùng lúc 1 bản sao cuối) để chứng minh cơ chế hoạt động đúng
- [ ] Bước 10: (Tuỳ chọn) Backup/PITR demo, RLS cho phân quyền Member, table partitioning cho `loans`
- [ ] Bước 11: (Tuỳ chọn) NestJS gateway nếu đề bài yêu cầu kiến trúc BFF
