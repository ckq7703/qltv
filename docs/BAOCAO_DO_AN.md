# BÁO CÁO ĐỒ ÁN MÔN HỌC HỆ CƠ SỞ DỮ LIỆU

**Đề tài:** Xây dựng hệ thống quản lý thư viện (QLTV) minh họa các kỹ thuật thiết kế và vận hành cơ sở dữ liệu quan hệ

**Họ tên sinh viên:** [Điền tên bạn]
**Mã số sinh viên:** [Điền MSSV]
**Lớp / Khóa:** [Điền lớp]
**Giảng viên hướng dẫn:** [Điền tên giảng viên]

> Ghi chú khi nộp bài: thay các mục trong ngoặc vuông bằng thông tin thật, sau đó có thể chuyển file này sang Word hoặc PDF nếu trường yêu cầu định dạng đó.

---

## Mục lục

1. Lời mở đầu
2. Mục tiêu và phạm vi đồ án
3. Công nghệ sử dụng
4. Phân tích và thiết kế cơ sở dữ liệu
5. Transaction và kiểm soát tương tranh
6. Trigger
7. View và Materialized View
8. Index và tối ưu truy vấn
9. Cache Redis (cache-aside)
10. Xác thực và phân quyền
11. Kiến trúc hệ thống và giao diện
12. Kiểm thử hệ thống
13. Kết quả đạt được
14. Hạn chế và hướng phát triển
15. Tài liệu tham khảo

---

## 1. Lời mở đầu

Quản lý thư viện là một bài toán quen thuộc nhưng chứa đủ các tình huống cần xử lý ở tầng cơ sở dữ liệu: nhiều bảng liên quan với nhau, có thao tác đọc/ghi đồng thời, cần tra cứu và thống kê nhanh trên dữ liệu lớn dần theo thời gian. Vì vậy đề tài này chọn nghiệp vụ thư viện làm bối cảnh để thực hành các kỹ thuật đã học trong môn Hệ Cơ sở dữ liệu: chuẩn hóa lược đồ, transaction, trigger, view, index và cache.

Đồ án không đặt mục tiêu xây dựng một sản phẩm thương mại đầy đủ tính năng. Trọng tâm là chứng minh từng kỹ thuật cơ sở dữ liệu hoạt động đúng trên một hệ thống thật, có thể chạy được và kiểm thử được, thay vì chỉ trình bày lý thuyết.

## 2. Mục tiêu và phạm vi đồ án

### 2.1. Mục tiêu

- Thiết kế lược đồ cơ sở dữ liệu chuẩn hóa cho nghiệp vụ mượn/trả sách.
- Xử lý đúng tình huống tương tranh khi nhiều người cùng mượn một cuốn sách chỉ còn một bản.
- Dùng trigger để giữ dữ liệu nhất quán tự động thay vì tính toán thủ công ở tầng ứng dụng.
- Dùng view và materialized view để phục vụ thống kê, báo cáo.
- Đánh index và đo hiệu năng truy vấn trước/sau khi thêm index bằng `EXPLAIN ANALYZE`.
- Áp dụng cache Redis theo mô hình cache aside cho truy vấn tìm kiếm sách.

### 2.2. Phạm vi

Đồ án xây dựng một ứng dụng quản lý thư viện quy mô nhỏ với hai vai trò: **quản trị viên** (thủ thư, quản lý toàn bộ sách/độc giả/phiếu mượn) và **độc giả** (tự mượn và trả sách của chính mình, xem lịch sử mượn). Phần giao diện web chỉ được xây dựng ở mức đủ dùng để thao tác và kiểm chứng nghiệp vụ, không phải trọng tâm chấm điểm của môn học này.

Nhóm quyết định không triển khai các phần sau vì không phải yêu cầu bắt buộc của môn học: gateway NestJS làm lớp trung gian riêng, demo point in time recovery bằng WAL, và cơ chế tự động lên lịch làm mới materialized view (hiện có API để làm mới thủ công).

## 3. Công nghệ sử dụng

| Thành phần | Công nghệ | Phiên bản |
|---|---|---|
| Hệ quản trị CSDL | PostgreSQL | 16 |
| Cache / lưu refresh token | Redis | 7 |
| Backend | Python, FastAPI | Python 3.12, FastAPI 0.115.0 |
| ORM và migration | SQLAlchemy, Alembic | SQLAlchemy 2.0.35, Alembic 1.13.2 |
| Driver kết nối Postgres | psycopg2-binary | 2.9.9 |
| Xác thực | JWT (python-jose), bcrypt (passlib) | jose 3.3.0, bcrypt 4.0.1 |
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui | React 19 |
| Đóng gói | Docker, Docker Compose | - |
| Kiểm thử | pytest, httpx | pytest 8.3.3 |

Lý do chọn PostgreSQL thay vì MySQL: PostgreSQL hỗ trợ sẵn full-text search bằng `tsvector`/GIN index, `SELECT ... FOR UPDATE SKIP LOCKED` để xử lý tương tranh, và materialized view. Cả ba tính năng này đều được dùng trực tiếp trong đồ án nên PostgreSQL phù hợp hơn.

## 4. Phân tích và thiết kế cơ sở dữ liệu

### 4.1. Danh sách bảng và mối quan hệ

Lược đồ gồm 9 bảng chính:

| Bảng | Vai trò | Quan hệ chính |
|---|---|---|
| `authors` | Tác giả | 1 tác giả có thể viết nhiều sách (n:n qua `book_authors`) |
| `categories` | Thể loại sách | Tự tham chiếu (`parent_id`) để hỗ trợ thể loại cha/con |
| `books` | Đầu sách (tựa đề, ISBN...) | Thuộc 1 thể loại, có nhiều tác giả, có nhiều bản sao |
| `book_authors` | Bảng nối n:n giữa sách và tác giả | Khóa chính ghép `(book_id, author_id)` |
| `book_copies` | Từng bản sao vật lý của 1 đầu sách | Thuộc 1 sách, được mượn qua bảng `loans` |
| `members` | Độc giả | Có thể có 1 tài khoản đăng nhập (`users.member_id`) |
| `loans` | Phiếu mượn, gắn với 1 bản sao cụ thể | Tham chiếu `book_copies` và `members` |
| `users` | Tài khoản đăng nhập | Có vai trò `admin` hoặc `member`, liên kết tùy chọn tới `members` |
| `audit_log` | Nhật ký thay đổi trên `books` và `loans` | Ghi tự động qua trigger, không phải do ứng dụng ghi tay |

Điểm cần giải thích rõ trong thiết kế: bảng `loans` không tham chiếu trực tiếp `book_id` mà tham chiếu `book_copy_id`. Lý do là một đầu sách có thể có nhiều bản sao, và hệ thống cần biết chính xác bản sao nào đang được mượn để tránh cho hai độc giả cùng mượn trùng một bản. Đây cũng là điều kiện cần để phần 5 (transaction và tương tranh) có thể khóa đúng một dòng dữ liệu cụ thể.

### 4.2. Chuẩn hóa dữ liệu

Lược đồ ban đầu (nếu thiết kế đơn giản) thường gộp tên tác giả và thể loại trực tiếp vào bảng sách, và lưu số lượng bản sao dưới dạng một cột đếm (`total_copies`, `available_copies`). Cách làm này vi phạm chuẩn 2NF/3NF và gây khó khăn khi cần biết chính xác bản sao nào đang được mượn. Đồ án tách các phần này ra:

- **Tách `authors` khỏi `books`:** một tác giả có thể viết nhiều sách, và một sách có thể có nhiều tác giả. Nếu lưu tên tác giả trực tiếp trong bảng sách, tên tác giả bị lặp lại ở nhiều dòng và khó sửa khi tác giả đổi tên. Bảng nối `book_authors` giải quyết quan hệ n:n này.
- **Tách `categories` khỏi `books`:** cho phép một thể loại có thể có thể loại con (`parent_id` tự tham chiếu), thay vì chỉ lưu tên thể loại dạng chuỗi tự do dễ bị nhập sai chính tả hoặc trùng lặp không kiểm soát được.
- **Tách `book_copies` khỏi `books`:** đây là quyết định thiết kế quan trọng nhất của đồ án. Thay vì lưu một số nguyên `available_copies` trên bảng `books`, mỗi bản sao vật lý là một dòng riêng trong `book_copies`, có `status` là `available`, `borrowed`, `lost` hoặc `damaged`. Số lượng còn lại (`available_copies`) trở thành dữ liệu suy diễn (derived data), tính bằng cách đếm số dòng `book_copies` có `status = 'available'`, không lưu trực tiếp. Cách này tránh được tình trạng con số đếm bị lệch so với thực tế khi có lỗi ở tầng ứng dụng, và cho phép khóa đúng một bản sao cụ thể khi xử lý tương tranh.
- **Tách `users` khỏi `members`:** một độc giả (`member`) không bắt buộc phải có tài khoản đăng nhập. Việc tách riêng giúp hệ thống có thể quản lý độc giả (ví dụ do thủ thư nhập tay) độc lập với việc cấp tài khoản tự phục vụ, đồng thời cho phép thêm vai trò `admin` mà không cần gắn với một độc giả nào.

### 4.3. Ràng buộc toàn vẹn dữ liệu

Ngoài khóa chính, khóa ngoại, đồ án dùng thêm ràng buộc `CHECK` để chặn dữ liệu sai ngay ở tầng cơ sở dữ liệu, không phụ thuộc hoàn toàn vào việc kiểm tra ở tầng ứng dụng:

```sql
-- book_copies.status chỉ nhận 1 trong 4 giá trị hợp lệ
CHECK (status IN ('available', 'borrowed', 'lost', 'damaged'))

-- users.role chỉ nhận 'admin' hoặc 'member'
CHECK (role IN ('admin', 'member'))

-- Ngày trả sách không thể sớm hơn ngày mượn
CHECK (returned_at IS NULL OR returned_at >= borrowed_at)
```

Ràng buộc cuối cùng minh họa rõ giá trị của việc đặt logic ở tầng cơ sở dữ liệu: dù ứng dụng có lỗi lập trình khiến ngày trả bị tính sai, PostgreSQL vẫn từ chối lưu dữ liệu vô lý đó.

## 5. Transaction và kiểm soát tương tranh

Đây là phần trọng tâm của đồ án, vì nghiệp vụ mượn sách là nơi dễ xảy ra lỗi tương tranh nhất trong toàn hệ thống.

### 5.1. Vấn đề

Giả sử một đầu sách chỉ còn đúng 1 bản sao khả dụng. Nếu hai độc giả cùng bấm mượn gần như đồng thời, cả hai truy vấn đều có thể đọc thấy "còn 1 bản khả dụng" trước khi bất kỳ ai ghi dữ liệu, dẫn đến việc cả hai đều mượn được cùng một bản sao. Đây là lỗi race condition kinh điển khi nhiều transaction cùng đọc rồi ghi trên cùng một dữ liệu mà không có cơ chế khóa phù hợp.

### 5.2. Giải pháp: pessimistic locking với `SELECT ... FOR UPDATE SKIP LOCKED`

Đồ án xử lý toàn bộ nghiệp vụ mượn sách trong một transaction duy nhất tại tầng cơ sở dữ liệu, không xử lý tương tranh ở tầng ứng dụng:

```sql
BEGIN;

SELECT id FROM book_copies
WHERE book_id = :book_id AND status = 'available'
LIMIT 1
FOR UPDATE SKIP LOCKED;

SELECT COUNT(*) FROM loans
WHERE member_id = :member_id AND returned_at IS NULL;

INSERT INTO loans (book_copy_id, member_id, due_date)
VALUES (:book_copy_id, :member_id, now() + interval '14 days');

COMMIT;
```

Cách hoạt động:

- `FOR UPDATE` khóa dòng `book_copies` vừa được chọn. Transaction khác cố đọc và khóa cùng dòng này phải chờ cho đến khi transaction hiện tại `COMMIT` hoặc `ROLLBACK`.
- `SKIP LOCKED` giúp transaction khác không phải chờ vô ích. Nếu dòng đang bị khóa, PostgreSQL bỏ qua dòng đó và chọn một bản sao khả dụng khác nếu còn, thay vì đứng chờ. Điều này phù hợp với nghiệp vụ mượn sách vì độc giả không quan tâm mượn đúng bản sao nào, chỉ cần một bản khả dụng.
- Giới hạn số sách mượn tối đa (3 cuốn/độc giả) cũng được kiểm tra trong cùng transaction này, để tránh trường hợp hai request cùng lúc đều đọc thấy độc giả "còn đang mượn 2 cuốn" rồi cùng cho phép mượn thêm, khiến độc giả vượt quá giới hạn.
- Mức cô lập (isolation level) dùng mặc định của PostgreSQL là `READ COMMITTED`. Đồ án không cần nâng lên `SERIALIZABLE` vì `FOR UPDATE` đã đủ để khóa đúng dòng dữ liệu cần bảo vệ.

Đồ án cũng cân nhắc phương án thay thế là optimistic locking bằng cột `version` trên `book_copies`: đọc dữ liệu không khóa, khi cập nhật thì thêm điều kiện `WHERE id = :id AND version = :old_version`, nếu không có dòng nào bị ảnh hưởng nghĩa là có transaction khác đã cập nhật trước, cần thử lại. Cột `version` đã được thêm sẵn trong bảng `book_copies` để dự phòng cho hướng này, nhưng đồ án chọn pessimistic locking làm phương án chính vì tải ghi (mượn/trả sách) trong nghiệp vụ thư viện không cao, còn trải nghiệm người dùng khi bị từ chối do xung đột nhiều lần sẽ kém hơn.

### 5.3. Kết quả kiểm thử

Kịch bản kiểm thử: 10 request `POST /loans/borrow` gửi đồng thời (dùng `ThreadPoolExecutor` trong Python) cho cùng một cuốn sách chỉ còn đúng 1 bản sao khả dụng.

Kết quả chạy thực tế:

- Đúng **1/10** request nhận được `201 Created`.
- **9/10** request còn lại nhận `409 Conflict` với thông báo không còn bản sao khả dụng.
- **0** lỗi 500, không có deadlock, không có request bị treo.

Kết quả này xác nhận cơ chế `FOR UPDATE SKIP LOCKED` hoạt động đúng: dù 10 request cùng chạy song song, cơ sở dữ liệu vẫn đảm bảo chỉ một request duy nhất mượn thành công bản sao cuối cùng.

## 6. Trigger

Đồ án dùng trigger để tự động đồng bộ dữ liệu, tránh việc tầng ứng dụng phải tự cập nhật nhiều bảng cho một thao tác nghiệp vụ (dễ quên cập nhật, dễ gây lệch dữ liệu nếu có nhiều nơi trong code cùng thao tác trên `loans`).

### 6.1. Trigger cập nhật trạng thái bản sao khi mượn/trả

```sql
CREATE FUNCTION fn_after_loan_insert() RETURNS TRIGGER AS $$
BEGIN
    UPDATE book_copies SET status = 'borrowed', version = version + 1
    WHERE id = NEW.book_copy_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_loan_insert
AFTER INSERT ON loans
FOR EACH ROW EXECUTE FUNCTION fn_after_loan_insert();
```

Khi một dòng mới được thêm vào `loans`, trigger tự chuyển bản sao tương ứng sang trạng thái `borrowed`. Tương tự, `trg_after_loan_return` (kích hoạt khi `loans.returned_at` được cập nhật từ `NULL` sang một giá trị cụ thể) tự chuyển bản sao về `available`. Tầng ứng dụng chỉ cần `INSERT` hoặc `UPDATE` bảng `loans`, không cần tự viết thêm câu lệnh cập nhật `book_copies`.

### 6.2. Trigger cập nhật vector tìm kiếm full text

```sql
CREATE FUNCTION fn_books_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('simple', coalesce(NEW.title, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_books_search_vector_update
BEFORE INSERT OR UPDATE OF title ON books
FOR EACH ROW EXECUTE FUNCTION fn_books_search_vector_update();
```

Cột `search_vector` (kiểu `tsvector`) phục vụ tìm kiếm full text được tự động tính lại mỗi khi tựa sách thay đổi, nên ứng dụng không cần tự gọi `to_tsvector` khi thêm hoặc sửa sách.

### 6.3. Trigger ghi nhật ký audit

`trg_audit_books` và `trg_audit_loans` ghi lại mọi thao tác `INSERT`, `UPDATE`, `DELETE` trên `books` và `loans` vào bảng `audit_log`, lưu dữ liệu trước và sau thay đổi dưới dạng `JSONB` (`to_jsonb(OLD)`, `to_jsonb(NEW)`). Mục đích là phục vụ truy vết: nếu dữ liệu bị sửa sai, có thể xem lại giá trị cũ mà không cần khôi phục toàn bộ bản backup.

## 7. View và Materialized View

Các truy vấn thống kê phức tạp được đóng gói trong view thay vì viết lặp lại ở nhiều nơi trong code ứng dụng.

| Tên | Loại | Mục đích |
|---|---|---|
| `v_top_borrowed_books` | View | Xếp hạng sách được mượn nhiều nhất, dùng `RANK()` |
| `v_overdue_loans` | View | Danh sách phiếu quá hạn, tính động từ `due_date < now()` |
| `v_active_members` | View | Xếp hạng độc giả mượn nhiều nhất, dùng `DENSE_RANK()` |
| `mv_monthly_stats` | Materialized view | Thống kê số lượt mượn theo từng tháng |

Ví dụ view tính phiếu quá hạn:

```sql
CREATE VIEW v_overdue_loans AS
SELECT l.id, l.member_id, bc.book_id, l.due_date,
       now() - l.due_date AS overdue_by
FROM loans l
JOIN book_copies bc ON bc.id = l.book_copy_id
WHERE l.returned_at IS NULL AND l.due_date < now();
```

View này không lưu dữ liệu riêng, mà tính lại mỗi lần được truy vấn dựa trên thời điểm hiện tại (`now()`). Vì vậy không cần một tiến trình nền chạy định kỳ để đánh dấu phiếu nào quá hạn.

Khác với 3 view trên, `mv_monthly_stats` là **materialized view**: kết quả được lưu vật lý và không tự cập nhật khi dữ liệu gốc thay đổi. Hệ thống cung cấp endpoint `POST /stats/refresh-monthly` gọi `REFRESH MATERIALIZED VIEW mv_monthly_stats` để làm mới thủ công. Lựa chọn materialized view ở đây phù hợp vì thống kê theo tháng không cần chính xác theo thời gian thực, và việc tính lại toàn bộ tổng hợp mỗi lần truy vấn sẽ tốn chi phí không cần thiết khi số lượng phiếu mượn tăng lên.

## 8. Index và tối ưu truy vấn

### 8.1. Các index đã tạo

| Index | Bảng | Loại | Mục đích |
|---|---|---|---|
| `idx_books_search` | `books` | GIN trên `tsvector` | Tìm kiếm sách theo tên (full text search) |
| `idx_books_category` | `books` | B-tree | Lọc/join theo thể loại |
| `idx_copies_book_status` | `book_copies` | B-tree ghép | Tìm nhanh bản sao khả dụng của 1 sách (dùng trong truy vấn mượn sách ở mục 5) |
| `idx_loans_member` | `loans` | B-tree | Tra cứu lịch sử mượn theo độc giả |
| `idx_loans_open` | `loans` | B-tree, partial index (`WHERE returned_at IS NULL`) | Chỉ index các phiếu chưa trả, giảm kích thước index so với index toàn bảng |

### 8.2. Kết quả đo bằng EXPLAIN ANALYZE

Để đo tác động thực tế của index, nhóm chèn tạm 20.000 dòng sách giả lập vào bảng `books` rồi chạy cùng một truy vấn tìm kiếm ở hai trạng thái: trước và sau khi có `idx_books_search`.

Truy vấn đo:
```sql
SELECT id, title FROM books WHERE search_vector @@ plainto_tsquery('simple', 'Database');
```
Số dòng khớp: 3.334/20.005 dòng.

| | Không có index | Có index (GIN) |
|---|---|---|
| Kế hoạch truy vấn | `Seq Scan` toàn bảng | `Bitmap Index Scan` + `Bitmap Heap Scan` |
| Số dòng bị loại sau khi đọc | 16.671 dòng | không cần đọc thừa |
| Planning Time | 0.803 ms | 1.092 ms |
| **Execution Time** | **4.576 ms** | **2.411 ms** |

Ở quy mô 20.000 dòng, thời gian thực thi giảm khoảng 1,9 lần (từ 4,58ms xuống 2,41ms). Con số tuyệt đối chưa lớn vì bộ dữ liệu thử nghiệm còn nhỏ, nhưng điều đáng chú ý hơn là **kế hoạch truy vấn thay đổi hẳn chiến lược**: không có index, PostgreSQL phải đọc toàn bộ bảng rồi loại bỏ 16.671 dòng không khớp (độ phức tạp O(n)); có index, PostgreSQL đọc thẳng các dòng khớp qua GIN index (gần O(log n) cộng với số kết quả khớp). Với dữ liệu ở quy mô một thư viện thực tế (hàng trăm nghìn đến hàng triệu dòng), khoảng cách hiệu năng giữa hai cách này sẽ giãn ra rất nhiều so với tỷ lệ 1,9 lần đo được ở quy mô nhỏ.

Dữ liệu thử nghiệm 20.000 dòng đã được xóa sau khi đo, không ảnh hưởng đến dữ liệu mẫu dùng để demo hệ thống.

## 9. Cache Redis (cache aside)

### 9.1. Thiết kế

Kết quả tìm kiếm sách (`GET /books?search=...&category_id=...&sort_by=...`) được cache theo mô hình cache aside:

1. Khi có request, tính key cache bằng cách băm SHA-256 toàn bộ tham số truy vấn (search, category, sắp xếp, trang) thành một chuỗi duy nhất, dạng `books:search:<hash>`.
2. Kiểm tra Redis với key đó trước. Nếu có (cache hit), trả kết quả từ Redis luôn, không truy vấn PostgreSQL.
3. Nếu không có (cache miss), truy vấn PostgreSQL, lưu kết quả vào Redis với thời gian sống (TTL) 60 giây, rồi trả kết quả.

Việc băm toàn bộ tham số (không chỉ riêng từ khóa tìm kiếm) là điểm cần lưu ý: nếu chỉ dùng từ khóa tìm kiếm làm key, hai truy vấn cùng từ khóa nhưng khác trang hoặc khác cách sắp xếp sẽ bị nhầm lẫn, trả sai kết quả cho nhau.

### 9.2. Chiến lược làm mới cache

Khi có sách mới, sách bị sửa/xóa, hoặc có người mượn/trả sách (làm thay đổi số lượng bản sao khả dụng), toàn bộ key cache thuộc nhóm `books:search:*` bị xóa chủ động thay vì chờ hết hạn TTL. Cách này ưu tiên tính đúng đắn của dữ liệu hơn là giữ cache lâu, chấp nhận đánh đổi là tỷ lệ cache hit có thể giảm nhẹ nếu có nhiều thao tác ghi liên tiếp.

### 9.3. Đo tỷ lệ hit/miss

Hệ thống đếm số lần hit và miss bằng 2 counter riêng trong Redis, expose qua `GET /stats/cache`. Khi gọi lặp lại cùng một truy vấn tìm kiếm 3 lần liên tiếp, số lần hit tăng dần đúng như kỳ vọng, xác nhận cơ chế cache hoạt động đúng.

## 10. Xác thực và phân quyền

### 10.1. Đăng nhập và JWT

Hệ thống dùng JWT (JSON Web Token) cho access token. Khi đăng nhập thành công, backend phát ra:

- **Access token**: chứa `user_id`, `role` (`admin` hoặc `member`), và `member_id` nếu tài khoản có liên kết tới một độc giả. Token này được gửi kèm mỗi request qua header `Authorization: Bearer <token>`.
- **Refresh token**: một chuỗi ngẫu nhiên, lưu trong Redis dưới dạng `refresh_token:<token> -> user_id` với thời gian sống bằng cấu hình `JWT_REFRESH_TTL`. Khi access token hết hạn, client gọi `POST /auth/refresh` để lấy access token mới mà không cần đăng nhập lại.

Khi refresh, hệ thống áp dụng **rotation**: token cũ bị xóa khỏi Redis ngay và một token mới được phát ra. Nếu một refresh token bị lộ và bị dùng lại sau khi đã rotate, request đó sẽ bị từ chối vì token cũ không còn tồn tại trong Redis.

### 10.2. Phân quyền theo vai trò

Hai vai trò trong hệ thống có phạm vi truy cập khác nhau:

- **Admin** (thủ thư): toàn quyền quản lý sách, tác giả, thể loại, độc giả, và xem/thao tác trên mọi phiếu mượn.
- **Member** (độc giả): chỉ được tự mượn sách cho chính mình, tự trả sách mình đang mượn, và chỉ xem được phiếu mượn của chính mình.

Việc phân quyền được kiểm tra ở tầng backend chứ không dựa vào giao diện: dependency `require_admin` chặn các endpoint ghi dữ liệu quan trọng (thêm/sửa/xóa sách, tác giả, thể loại, độc giả) nếu người gọi không có `role = admin`. Với nghiệp vụ mượn sách, nếu người gọi là `member`, hệ thống luôn lấy `member_id` từ claims trong JWT chứ không tin vào `member_id` gửi trong nội dung request, để tránh trường hợp một độc giả sửa request nhằm mượn hộ hoặc xem phiếu mượn của người khác.

## 11. Kiến trúc hệ thống và giao diện

Hệ thống gồm 3 thành phần chạy trong Docker Compose: PostgreSQL (lưu trữ chính), Redis (cache và refresh token), và backend FastAPI (xử lý toàn bộ nghiệp vụ, migration bằng Alembic). Giao diện web (React, TypeScript, Tailwind CSS, shadcn/ui) gọi trực tiếp API của backend qua HTTP, dùng để thao tác và kiểm tra trực quan các nghiệp vụ đã cài đặt: quản lý sách/độc giả/danh mục, quy trình mượn sách theo 3 bước (chọn độc giả, xem nội quy và xác nhận, nhận biên nhận), trang thống kê đọc từ các view ở mục 7, và thông báo thời gian thực cho quản trị viên khi có độc giả tự mượn sách (qua Redis Pub/Sub kết hợp WebSocket).

Phần giao diện không phải trọng tâm chấm điểm của môn học và được cố tình giữ ở mức đơn giản, ưu tiên thời gian cho phần thiết kế và vận hành cơ sở dữ liệu.

## 12. Kiểm thử hệ thống

Đồ án viết 15 test case tự động bằng `pytest`, chạy trực tiếp trên FastAPI `TestClient`:

| File | Số test | Nội dung kiểm tra |
|---|---|---|
| `test_books.py` | 4 | Liệt kê sách, tìm kiếm full text, phân quyền tạo sách (yêu cầu admin) |
| `test_concurrency.py` | 1 | 10 request mượn đồng thời cùng 1 bản sao cuối cùng (mục 5.3) |
| `test_loans.py` | 4 | Luồng mượn/trả, danh sách phiếu quá hạn, giới hạn số sách mượn tối đa, chặn truy cập ẩn danh |
| `test_member_self_service.py` | 6 | Endpoint `/auth/me`, chặn giả mạo `member_id`, chặn member trả phiếu của người khác, member chỉ thấy phiếu của chính mình |

Kết quả chạy: **15/15 test pass**. Bộ test có một fixture tự dọn dữ liệu sau khi chạy (xóa các bản ghi do chính test tạo ra theo đúng thứ tự khóa ngoại), nên có thể chạy lại nhiều lần liên tiếp mà không làm tích lũy dữ liệu rác trong cơ sở dữ liệu dùng để demo.

## 13. Kết quả đạt được

Đồ án đã hoàn thành các phần sau, đều đã chạy được và có kết quả kiểm chứng thực tế (không chỉ dừng ở thiết kế trên giấy):

- Lược đồ cơ sở dữ liệu chuẩn hóa với 9 bảng, đã cài đặt bằng Alembic migration, có thể tái tạo từ đầu bằng `alembic upgrade head`.
- Xử lý tương tranh khi mượn sách bằng `SELECT ... FOR UPDATE SKIP LOCKED`, đã kiểm chứng bằng test 10 request song song.
- 5 trigger đồng bộ trạng thái bản sao, cập nhật vector tìm kiếm, và ghi audit log.
- 3 view và 1 materialized view phục vụ thống kê.
- 5 index (gồm 1 GIN full text và 1 partial index), đo hiệu năng thực tế bằng `EXPLAIN ANALYZE` cho thấy chuyển từ `Seq Scan` sang `Bitmap Index Scan`.
- Cache aside bằng Redis cho tìm kiếm sách, có đo tỷ lệ hit/miss.
- Xác thực JWT với refresh token rotation, phân quyền admin/member ở tầng backend.
- 15 test tự động, chạy lại được nhiều lần không tích lũy dữ liệu rác.
- Giao diện web đủ dùng để thao tác và kiểm chứng trực quan mọi nghiệp vụ trên.

## 14. Hạn chế và hướng phát triển

Những phần sau đã được cân nhắc trong quá trình thiết kế nhưng chưa triển khai, vì không bắt buộc với quy mô đồ án:

- **Row Level Security (RLS) của PostgreSQL**: hiện việc chặn member xem dữ liệu của người khác được xử lý bằng điều kiện `WHERE` ở tầng backend. Dùng RLS sẽ đẩy việc kiểm soát này xuống tầng cơ sở dữ liệu, giảm rủi ro nếu một endpoint mới quên thêm điều kiện lọc theo `member_id`.
- **So sánh optimistic locking với pessimistic locking**: cột `version` trên `book_copies` đã có sẵn nhưng chưa được dùng để cài đặt và đo hiệu năng nhánh optimistic locking dưới tải đồng thời, để so sánh trực tiếp với kết quả ở mục 5.3.
- **Demo Point in Time Recovery (PITR) bằng WAL**: hiện chỉ có kế hoạch backup bằng `pg_dump`, chưa cấu hình WAL archiving để minh họa khôi phục dữ liệu về một thời điểm bất kỳ trong quá khứ.
- **Table partitioning cho bảng `loans`**: với dữ liệu lớn dần theo thời gian, có thể chia bảng `loans` theo tháng/năm dựa trên `borrowed_at` để giữ hiệu năng truy vấn ổn định. Với quy mô dữ liệu của đồ án, bảng `loans` chưa đủ lớn để cần bước này.
- **Tự động làm mới materialized view theo lịch**: hiện `mv_monthly_stats` chỉ làm mới khi có người gọi API thủ công, chưa có tiến trình nền (cron job) tự chạy `REFRESH MATERIALIZED VIEW` định kỳ.

Đây đều là những hướng có thể trình bày thêm ở phần bảo vệ đồ án dưới dạng phân tích lý thuyết, ngay cả khi chưa triển khai thật trong code.

## 15. Tài liệu tham khảo

- Tài liệu chính thức PostgreSQL 16: https://www.postgresql.org/docs/16/
- Tài liệu FastAPI: https://fastapi.tiangolo.com/
- Tài liệu SQLAlchemy 2.0: https://docs.sqlalchemy.org/en/20/
- Tài liệu Redis: https://redis.io/docs/latest/
- File đặc tả gốc của đồ án: `library-system-spec.md` (cùng thư mục gốc dự án)
- Chi tiết thiết kế cơ sở dữ liệu: `docs/DATABASE.md`
- Kiến trúc hệ thống: `docs/ARCHITECTURE.md`
- Toàn bộ số liệu benchmark gốc: `docs/BENCHMARKS.md`
