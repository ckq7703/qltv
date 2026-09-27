# PLAN.md — Kế hoạch triển khai chi tiết QLTV

> File này là nguồn tiếp nối ngữ cảnh giữa các session. Đầu mỗi session: đọc phần "Trạng thái hiện tại" rồi đối chiếu với thư mục dự án thật. Cuối mỗi phase: tick checkbox và cập nhật "Trạng thái hiện tại".

## Trạng thái hiện tại
- **Phase 0-9 đã hoàn thành** (hạ tầng Docker, schema chuẩn hóa, trigger/view/index, CRUD API, concurrency control, auth JWT, cache-aside, benchmark, thống kê). Stack backend chạy được bằng `docker compose up -d`, đã migrate + seed dữ liệu mẫu, toàn bộ **15/15 test** (`pytest`) pass — bao gồm test concurrency trọng tâm và test phân quyền member self-service. Test suite tự dọn dữ liệu rác sau mỗi phiên chạy (xem Phase 13i).
- **Phase 13 (Frontend) đã hoàn thành và mở rộng nhiều đợt** (13a → 13l): React + Vite + TypeScript + Tailwind v4 + shadcn/ui (bản base-ui), layout **sidebar** (không dùng topbar), toàn bộ UI tiếng Anh. Dev server chạy tại `http://localhost:5173` (hoặc `:5174` nếu 5173 bận), proxy `/api` + `/ws` → backend. Ngoài CRUD sách/độc giả/danh mục còn có: member tự mượn/trả sách (self-service, Phase 13d), borrow wizard 3 bước + nội quy (Phase 13f), thông báo realtime cho admin qua WebSocket khi member tự mượn (Phase 13f/13g, click thông báo mở thẳng chi tiết phiếu), avatar người thật cho member (Phase 13h), pagination footer đồng bộ (Rows/trang + Page X of Y + First/Last) cho toàn bộ bảng danh sách (Phase 13k), chọn tác giả + quản lý trạng thái từng bản sao (lost/damaged) qua UI, search cho Categories/Loans (Phase 13l). Đã type-check sạch (`tsc -b`), lint sạch (`oxlint`), xác nhận toàn bộ API mà UI gọi hoạt động đúng qua proxy với dữ liệu thật, đã build-test Docker image cho service `frontend` thành công. **Lưu ý**: chưa xác minh trực quan bằng trình duyệt thật trong suốt session (không có công cụ browser/screenshot trong môi trường này) — chỉ xác nhận qua type-check + lint + kiểm tra HTTP response, nên hãy tự mở `http://localhost:5173` để xem giao diện trước khi coi là hoàn tất.
- Kết quả thực nghiệm đã ghi vào `docs/BENCHMARKS.md`.
- **Phase 12 (báo cáo đồ án) đã hoàn thành**: `docs/BAOCAO_DO_AN.md` — báo cáo tiếng Việt đầy đủ 15 mục theo cấu trúc đồ án môn học, mọi số liệu lấy từ code/migration/test thật đã chạy trong dự án (không có số liệu bịa), viết theo hướng dẫn skill `humanizer` để tránh văn phong AI (không dùng dấu gạch ngang dài/ngắn, không dùng cụm sáo rỗng). **Còn thiếu duy nhất**: điền thông tin cá nhân (tên, MSSV, lớp, giảng viên) vào đầu file trước khi nộp — phần này chỉ người dùng mới điền được.
- **Chưa làm**: Phase 10 (backup/PITR demo, tuỳ chọn), Phase 11 (NestJS gateway, tuỳ chọn). Checklist UI coi như đã dọn xong các mục có giá trị thực tế; chỉ còn 2 mục UI cố ý bỏ qua vì không phải trọng tâm chấm điểm và giá trị thấp so với công sức: nút Filters/Columns kiểu popover cho Members/Loans/Categories, checkbox bulk-select trên bảng. Ngoài ra optimistic locking so sánh (Phase 5/8) vẫn là tuỳ chọn cho báo cáo.
- Phase tiếp theo cần làm: điền thông tin cá nhân vào `docs/BAOCAO_DO_AN.md` rồi nộp. Phase 10/11 chỉ làm nếu còn thời gian, không bắt buộc.

---

## Mục tiêu
Xây dựng đồ án QLTV theo đặc tả trong `library-system-spec.md`, ưu tiên chiều sâu thiết kế/vận hành CSDL hơn là số lượng tính năng hay độ hoàn thiện giao diện.

## Quyết định đã chốt (không hỏi lại người dùng các điểm này)
- **Concurrency**: `SELECT ... FOR UPDATE SKIP LOCKED` là phương án chính cho nghiệp vụ mượn sách. Optimistic locking (cột `version`) là phương án so sánh/đối chiếu trong báo cáo, không phải phương án chính.
- **Model mượn sách**: dùng bảng `book_copies` (mỗi bản sao vật lý = 1 row), không đếm `total_copies`/`available_copies` thô ở bảng `books`.
- **NestJS**: tuỳ chọn, triển khai ở phase cuối cùng (Phase 11) nếu còn thời gian. Không bắt buộc cho đồ án.
- **Trigger/view/index**: định nghĩa trong Alembic migration bằng `op.execute()`, không tạo tay ngoài quy trình migration.
- **Trọng tâm báo cáo**: chuẩn hóa schema, transaction/concurrency, trigger, view/materialized view, index + EXPLAIN ANALYZE, cache-aside Redis.

## Câu hỏi còn mở (hỏi người dùng khi tới phase liên quan, không cần hỏi trước)
- Phase 6: Có cần triển khai Row-Level Security (RLS) thật hay chỉ mô tả lý thuyết trong báo cáo?
- Phase 10: Có cần demo WAL/PITR thật hay chỉ lý thuyết?
- Phase 12: Báo cáo viết bằng tiếng Việt hay tiếng Anh?

## Cấu trúc thư mục mục tiêu
```
QLTV/
├── library-system-spec.md
├── CLAUDE.md
├── PLAN.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   └── BENCHMARKS.md          # tạo ở Phase 8
├── .claude/skills/
├── docker-compose.yml          # Phase 1
├── .env.example                 # Phase 1
├── backend/                     # Phase 2+
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── migrations/versions/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── cache/               # Redis client, cache-aside helpers
│   │   └── seed.py              # Phase 2/data seed
│   └── tests/
│       ├── test_books.py
│       ├── test_loans.py
│       └── test_concurrency.py  # Phase 5
├── frontend/                     # Phase 13
│   ├── Dockerfile
│   ├── vite.config.ts
│   ├── src/
│   │   ├── App.tsx
│   │   ├── types.ts
│   │   ├── lib/                 # api.ts (axios + refresh), auth-context.tsx
│   │   ├── components/          # AdminRoute, layout/AppLayout (sidebar), ui/ (shadcn)
│   │   └── pages/                # LoginPage, BooksPage, MembersPage, LoansPage, StatsPage
│   └── components.json          # cấu hình shadcn/ui
└── gateway/                      # Phase 11, tuỳ chọn
```

---

## Phase 0 — Tài liệu & kế hoạch ✅ DONE
- [x] Phân tích spec ban đầu, chỉ ra vấn đề kiến trúc/nghiệp vụ
- [x] Chuẩn hóa schema (authors, categories, book_copies, m:n), thêm transaction/trigger/view/index vào `library-system-spec.md`
- [x] Viết `CLAUDE.md`, `PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, skills trong `.claude/skills/`

## Phase 1 — Hạ tầng Docker ✅ DONE
- [x] `docker-compose.yml`: service `postgres`, `redis`, `backend`
- [x] `.env.example` + `.env` (local, không commit): các biến POSTGRES_*, DATABASE_URL, REDIS_URL, JWT_*
- [x] **Acceptance**: `docker compose up -d --build` chạy được, `GET /health` trả `{"status":"ok"}`. Ghi chú: Dockerfile ban đầu có `apt-get install libpq-dev gcc` bị treo do mirror chậm — đã bỏ vì `psycopg2-binary` tự bundle libpq, không cần biên dịch.

## Phase 2 — Schema & Migration nền tảng ✅ DONE
- [x] FastAPI project skeleton (`backend/app/`) + SQLAlchemy models khớp `library-system-spec.md` mục 4 (`app/models/*.py`)
- [x] Alembic init + migration `0001_initial_schema.py`: tạo toàn bộ 9 bảng
- [x] **Acceptance**: `alembic upgrade head` chạy sạch — đã xác nhận qua `docker compose exec backend alembic upgrade head`, `\dt` trong psql cho thấy đủ 10 bảng (bao gồm `alembic_version`)

## Phase 3 — Trigger, View, Index ✅ DONE
- [x] Migration `0002_triggers.py`: `fn_after_loan_insert`, `fn_after_loan_return`, trigger audit cho `books`/`loans`
- [x] Migration `0003_views.py`: `v_top_borrowed_books`, `v_overdue_loans`, `v_active_members`, `mv_monthly_stats`
- [x] Migration `0004_indexes.py`: GIN full-text (`idx_books_search`, kèm trigger tự cập nhật `search_vector` từ `title`), `idx_books_category`, `idx_copies_book_status`, `idx_loans_member`, partial index `idx_loans_open`
- [x] **Acceptance**: `\dv` xác nhận đủ 3 view; trigger đã xác nhận hoạt động đúng qua seed data (loan quá hạn tự chuyển `book_copies.status`)

## Phase 4 — CRUD API sách/độc giả ✅ DONE
- [x] Router `books` (CRUD + tìm kiếm full-text qua `search_vector`), `authors`, `categories`, `members` — tất cả trong `app/routers/`
- [x] **Acceptance**: test qua `GET /books`, `POST /books` (curl) hoạt động đúng; unit test `tests/test_books.py` (4 test) pass

## Phase 5 — Nghiệp vụ mượn/trả + concurrency (trọng tâm đồ án) ✅ DONE
- [x] `POST /loans/borrow` (`app/services/loans.py`): transaction dùng `SELECT ... FOR UPDATE SKIP LOCKED` chọn 1 `book_copy` khả dụng
- [x] Giới hạn mượn tối đa 3 cuốn/độc giả kiểm tra trong cùng transaction (`MAX_ACTIVE_LOANS_PER_MEMBER`)
- [x] `POST /loans/{id}/return`
- [x] `tests/test_concurrency.py`: 10 request song song mượn "Foundation" (seed chỉ có 1 bản sao) — **kết quả: đúng 1/10 thành công, 9/10 trả 409, 0 lỗi 500/deadlock**
- [ ] (Tuỳ chọn, chưa làm) Cài song song bản optimistic locking (`version`) để so sánh — cột `version` đã có sẵn trong `book_copies` nhưng chưa dùng, có thể làm khi viết báo cáo nếu muốn so sánh 2 chiến lược
- [x] **Acceptance**: test concurrency pass (`pytest`), không deadlock, không 2 phiếu mượn trùng 1 bản sao — xác nhận thực tế, xem `docs/BENCHMARKS.md` mục 2

## Phase 6 — Auth JWT + Redis session ✅ DONE
- [x] `POST /auth/login`, `POST /auth/refresh` (có rotation — token cũ bị xoá, phát token mới), `POST /auth/logout`; refresh token lưu Redis với TTL (`app/services/auth.py`)
- [x] Phân quyền admin/member qua dependency `require_admin` (`app/deps.py`), áp dụng cho các endpoint ghi (POST/PUT/DELETE) của books/authors/categories/members
- [ ] (Tuỳ chọn, chưa làm — hỏi người dùng khi cần) Row-Level Security demo cho Member chỉ thấy dữ liệu của chính mình

## Phase 7 — Cache tìm kiếm Redis (cache-aside) ✅ DONE
- [x] Cache-aside cho `GET /books?search=&category_id=` (`app/cache/books_cache.py`), TTL 60s, key = SHA-256 hash của query params
- [x] Invalidate cache khi `books` thay đổi (create/update/delete) và khi mượn/trả sách (ảnh hưởng `available_copies`)
- [x] Đo hit/miss ratio qua `GET /stats/cache` — đã xác nhận hoạt động đúng (hit tăng khi gọi lại cùng query)

## Phase 8 — Benchmark & tối ưu ✅ DONE
- [x] `EXPLAIN (ANALYZE, BUFFERS)` trước/sau `idx_books_search` với 20.000 dòng dữ liệu bulk — kết quả: Seq Scan 4.576ms → Bitmap Index Scan 2.411ms, xem `docs/BENCHMARKS.md` mục 1
- [ ] (Tuỳ chọn, chưa làm) So sánh pessimistic (`FOR UPDATE`) vs optimistic (`version`) locking dưới tải đồng thời — cần cài thêm nhánh optimistic trước (xem Phase 5)
- [x] Ghi kết quả vào `docs/BENCHMARKS.md`

## Phase 9 — Thống kê / Dashboard (tuỳ chọn) — GẦN XONG
- [x] API đọc từ view (`GET /stats/top-books` → `v_top_borrowed_books`, `GET /stats/active-members` → `v_active_members`) — viết ở Phase 5 cùng lúc với routers, xem `app/routers/stats.py`
- [x] Endpoint refresh thủ công: `POST /stats/refresh-monthly` (`REFRESH MATERIALIZED VIEW mv_monthly_stats`)
- [ ] (Tuỳ chọn) Lịch tự động refresh materialized view (cron/scheduler) — hiện chỉ có endpoint thủ công, chưa tự động

## Phase 10 — Backup/Recovery & Audit (tuỳ chọn, học thuật)
- [ ] Demo `pg_dump` + restore
- [ ] (Tuỳ chọn — hỏi người dùng) Demo WAL/PITR

## Phase 11 — NestJS Gateway (tuỳ chọn, chỉ nếu còn thời gian)
- [ ] BFF mỏng: verify JWT, forward request xuống FastAPI, không chứa business logic

## Phase 12 — Viết báo cáo đồ án ✅ DONE
- [x] Viết `docs/BAOCAO_DO_AN.md`: báo cáo đầy đủ theo văn phong đồ án Việt Nam (mục tiêu/phạm vi, phân tích thiết kế + chuẩn hóa 3NF có ví dụ cụ thể, transaction/concurrency kèm kết quả test thật, trigger, view/materialized view, index kèm số liệu `EXPLAIN ANALYZE` thật từ `docs/BENCHMARKS.md`, cache Redis, xác thực/phân quyền, kiến trúc, kiểm thử, kết quả đạt được, hạn chế/hướng phát triển, tài liệu tham khảo)
- [x] Toàn bộ số liệu trong báo cáo lấy trực tiếp từ code/migration/test thật đã chạy (không bịa số liệu): đối chiếu lại đúng 9 bảng, 5 trigger, 3 view + 1 materialized view, 5 index, 15/15 test pass, kết quả concurrency 1/10 thành công - 9/10 trả 409
- [x] Viết theo hướng dẫn skill `humanizer` (`d:\03_DuAn_Code_CaNhan\AI\humanizer\humanizer\SKILL.md`) để tránh văn phong AI: không dùng dấu gạch ngang dài/ngắn (—/–), không dùng cụm sáo rỗng kiểu "đóng vai trò then chốt"/"toàn diện", không lạm dụng danh sách in đậm nông cạn
- [ ] **Chưa làm** (người dùng chọn giữ Markdown thay vì .docx): điền thông tin cá nhân thật (tên, MSSV, lớp, giảng viên hướng dẫn) vào phần đầu file trước khi nộp; nếu trường yêu cầu định dạng Word/PDF thì tự chuyển đổi hoặc yêu cầu Claude xuất bằng skill `docx`

## Phase 13 — Frontend (React + shadcn/ui) ✅ DONE
- [x] Scaffold `frontend/`: Vite + React 19 + TypeScript, Tailwind CSS v4, shadcn/ui (`npx shadcn@latest init`, bản dùng `@base-ui/react` thay vì Radix)
- [x] Router: `react-router-dom`, layout **sidebar** (`SidebarProvider`/`Sidebar`/`SidebarInset` của shadcn) — đổi từ topbar sang sidebar theo yêu cầu người dùng
- [x] Auth: `src/lib/api.ts` (axios instance, interceptor tự refresh token khi 401, decode JWT phía client lấy role), `src/lib/auth-context.tsx` (React context), `AdminRoute` bảo vệ route theo role
- [x] Trang: `LoginPage`, `BooksPage` (search debounce, CRUD sách cho admin, dialog mượn sách chọn độc giả), `MembersPage` (CRUD độc giả, admin), `LoansPage` (tabs Active/Overdue, trả sách), `StatsPage` (top books, active members, cache hit ratio, nút refresh materialized view)
- [x] Toàn bộ UI text bằng **tiếng Anh** (theo yêu cầu người dùng, đổi từ bản nháp tiếng Việt ban đầu)
- [x] `docker-compose.yml`: thêm service `frontend` (Dockerfile riêng, dev server `npm run dev -- --host`, proxy API tới `http://backend:8000` trong mạng Docker qua biến `VITE_API_PROXY_TARGET`) — **chưa build-test service này trong Docker**, mới chạy qua `npm run dev` trên host
- [x] **Acceptance đã xác nhận**: `npx tsc -b` sạch; dev server chạy (`http://localhost:5173`, tự chuyển `:5174` nếu bận); toàn bộ API mà UI dùng (`/auth/login`, `/members`, `/loans?status=`, `/stats/*`) trả dữ liệu đúng qua proxy `/api`
- [x] **UI polish** (theo yêu cầu người dùng — "chưa đẹp, thêm hình ảnh/icon"): thêm component `BookCover` (gradient placeholder + icon `BookOpen`, xác định theo hash id sách — không phụ thuộc ảnh ngoài); `BooksPage` chuyển từ bảng sang lưới card có ảnh bìa + filter thể loại; `StatsPage` dùng icon-stat-card kiểu dashboard (Gauge/Zap/Target/TrendingUp/Users); `LoginPage` có icon branding; `MembersPage` dùng `Avatar` initials + icon liên hệ (Mail/Phone/CalendarDays) thay vì bảng thuần text; `LoansPage` dùng icon trạng thái (Clock/AlertTriangle/CheckCircle2); sidebar (`AppLayout`) nhóm menu theo `SidebarGroup` (Catalog/Management) có logo icon
- [ ] **Chưa làm**: xác minh trực quan bằng trình duyệt thật (môi trường này không có browser/screenshot tool) — người dùng cần tự mở app để kiểm tra giao diện/tương tác trước khi coi là hoàn tất; build-test `docker compose up -d frontend`; component `form` (react-hook-form) của shadcn chưa cài, form hiện viết tay bằng `useState`

### Phase 13b — Sửa sách, upload ảnh bìa, filter nâng cao, phân trang & sort ✅ DONE
(bổ sung theo yêu cầu người dùng sau khi xem qua bản đầu)
- [x] **Backend — pagination & sort**: `GET /books`, `GET /members`, `GET /loans` đổi sang trả envelope `{items, total, page, page_size, total_pages}` (`app/schemas/pagination.py`, generic `Page[T]`). `books`: `sort_by` (title/created_at/available_copies), `sort_dir`, `available_only`. `members`: `search` (ilike full_name/email), `sort_by` (full_name/joined_at). `loans`: `sort_by`/`sort_dir` cho cả nhánh `borrowed` (SQLAlchemy) lẫn `overdue` (raw SQL trên view `v_overdue_loans`, nội suy `sort_dir` trực tiếp vì đã được FastAPI validate qua `Literal["asc","desc"]`)
- [x] **Cache-aside cập nhật theo pagination**: `books_cache.py` đổi `_cache_key`/`get_or_set_search_cache` sang nhận `dict` tham số bất kỳ (bao gồm page/sort/available_only) để tránh trả nhầm cache của tổ hợp filter khác
- [x] **Upload ảnh bìa**: `POST /uploads/cover` (multipart, admin only, giới hạn 5MB, chỉ nhận png/jpeg/webp/gif) lưu vào `backend/app/static/covers/` (bind-mount nên persist qua restart), serve qua `app.mount("/static", ...)`. Cần `python-multipart` trong `requirements.txt`
- [x] **Sửa sách (edit)**: `BooksPage` giờ có dialog dùng chung cho create/edit, gọi `PUT /books/{id}`; thêm endpoint mới `POST /books/{id}/copies` (chỉ **thêm** bản sao, không hỗ trợ giảm — xoá/đánh dấu hỏng 1 bản sao cụ thể cần thao tác trực tiếp trên `book_copies.status` vì không thể suy luận từ một con số tổng)
- [x] **Frontend — filter nâng cao**: `BooksPage` có nút "Filters" dạng `Popover` (category, available-only checkbox, sort by/dir) tách khỏi thanh tìm kiếm chính; `MembersPage` có ô search + sort
- [x] **Frontend — phân trang**: component dùng chung `src/components/PaginationBar.tsx` (dựa trên `ui/pagination.tsx` của shadcn), áp dụng cho Books (12/trang), Members (9/trang), Loans cả 2 tab (10/trang)
- [x] **Đã test qua API thật** (qua proxy `/api`): edit book, add-copies, category filter, sort, pagination đều trả kết quả đúng; `pytest` 8/8 vẫn pass sau khi cập nhật test cho envelope mới (`resp.json()["items"]` thay vì list thẳng)
- [ ] **Chưa làm**: chọn tác giả (author_ids) trong form tạo/sửa sách — hiện chỉ set qua seed/API trực tiếp; giảm số bản sao qua UI; xác minh trực quan trên trình duyệt thật

### Phase 13c — Card sách nâng cấp UI/UX + Category Management ✅ DONE
(bổ sung theo yêu cầu người dùng sau khi xem qua bản 13b)
- [x] **Card sách kiểu "poster hover"**: bỏ khung `Card` mặc định, ảnh bìa full-bleed sát viền, khung riêng (`bg-card` + `shadow-sm` → `shadow-lg` khi hover, không dùng `ring`/border theo yêu cầu), nâng nhẹ + zoom ảnh khi hover, badge số lượng dạng ribbon (`clip-path` polygon, gradient đen từ phải sang trái, chữ trắng), action buttons (Mượn/Sửa/Xoá) ẩn/hiện khi hover đè lên ảnh thay vì luôn hiện dưới text — khắc phục luôn vấn đề card lệch hàng khi tên sách dài ngắn khác nhau. Lưới 5 cột × 2 hàng (`page_size=10`)
- [x] **Category Management (`/categories`, admin)**: trang CRUD danh mục mới — `frontend/src/pages/CategoriesPage.tsx`, thêm vào sidebar nhóm "Management"
- [x] **Backend — hoàn thiện CRUD categories**: `PUT /categories/{id}`, `DELETE /categories/{id}` (trước đó chỉ có GET/POST). Đổi POST từ query param sang JSON body (`CategoryCreate`/`CategoryUpdate` trong `app/routers/categories.py`). Chặn xoá danh mục còn danh mục con hoặc còn sách gán vào (409, không cho xoá ngầm mất dữ liệu). Chặn set `parent_id` = chính nó (422)
- [x] **Sửa 2 bug backend phát hiện khi viết test cho tính năng này**:
  1. `Book.copies` relationship thiếu `passive_deletes=True` → xoá sách có bản sao bị crash 500 (SQLAlchemy cố `UPDATE book_copies SET book_id=NULL` thay vì để Postgres tự `ON DELETE CASCADE` theo migration 0001). Đã sửa `app/models/book.py`.
  2. `DELETE /books/{id}` không kiểm tra lịch sử mượn trước khi xoá → nếu sách từng được mượn, xoá sẽ bị `loans.book_copy_id` (FK RESTRICT) chặn và trả lỗi 500 thô. Đã thêm kiểm tra trả 409 rõ ràng ("Cannot delete a book that has loan history") để giữ audit trail, xem `app/routers/books.py`
- [x] **Sửa flakiness của `test_concurrency.py`**: trước đây phụ thuộc dữ liệu seed dùng chung ("Foundation" phải còn đúng 1 bản sao) — từng bị lệch 2 lần do thao tác tay lúc debug thủ công qua curl. Giờ test tự tạo sách + bản sao riêng, không phụ thuộc seed, chạy lặp lại nhiều lần vẫn pass
- [x] **Đã test**: category CRUD qua proxy `/api` (create/update/delete với dữ liệu thật), `pytest` 8/8 pass và chạy lặp lại 3 lần liên tiếp không flaky

### Phase 13d — Member tự mượn/trả sách (self-service) ✅ DONE
(người dùng hỏi "vì sao member không mượn được" — trước đó là chủ đích theo spec gốc, nhưng quyết định bổ sung tính năng tự mượn)
- [x] **JWT giờ mang `member_id`**: `create_access_token()` nhận thêm tham số `member_id`, nhúng vào claims; `services/auth.py` truyền `user.member_id` khi login/refresh
- [x] **`GET /auth/me`**: trả `user_id`, `role`, `member_id`, và tên/email member nếu có liên kết — dùng cho frontend hiển thị hồ sơ
- [x] **Phân quyền chặt cho `/loans/*`** (trước đó hoàn toàn không có `Depends` nào — ai gọi cũng được!): `POST /loans/borrow` giờ bắt buộc đăng nhập; member luôn mượn cho chính mình (`member_id` trong body bị bỏ qua nếu có, tránh giả mạo mượn hộ người khác qua sửa request), chỉ admin được chỉ định `member_id` tuỳ ý. `POST /loans/{id}/return` chặn member trả phiếu không phải của mình (403). `GET /loans` tự lọc chỉ hiện phiếu của chính member khi role=member, admin vẫn thấy toàn bộ
- [x] **Frontend**: `RequireAuth` (route cho mọi user đã đăng nhập, khác `AdminRoute` chỉ admin) — trang mới `MyLoansPage.tsx` (`/my-loans`, tab Active/Overdue, tự trả sách); `BooksPage` thêm nút "Borrow" cho member (tự mượn, không cần chọn độc giả như admin); sidebar thêm nhóm "My Library" riêng cho role=member
- [x] **Test tự động mới** (`tests/test_member_self_service.py`, `tests/conftest.py` thêm fixture `member_headers`): xác nhận `/auth/me` đúng, chặn anonymous, member không giả mạo được `member_id`, member không trả được phiếu của người khác (403), `GET /loans` chỉ trả phiếu của chính mình. 14/14 test pass, chạy lặp lại 3 lần không flaky
- [x] **Đã test qua proxy `/api` với dữ liệu thật**: login member → `/auth/me` → tự mượn sách → tự trả sách, toàn bộ đúng luồng

### Phase 13e — Tạo tài khoản đăng nhập ngay khi thêm member mới ✅ DONE
(người dùng gặp lỗi "account not linked to a member profile" — nguyên nhân: member tạo qua UI trước đó không có tài khoản đăng nhập đi kèm)
- [x] **Backend**: `POST /members` nhận thêm `username`/`password` tuỳ chọn (`MemberCreate`) — nếu cả hai được điền, tạo luôn `users` row (role=member, `member_id` trỏ về member vừa tạo). Validate: phải điền cùng lúc cả hai hoặc bỏ trống cả hai (422); trùng username → 409. `MemberOut` giờ có thêm `username` (null nếu chưa có tài khoản) — `GET /members` join thêm bảng `users` để trả kèm
- [x] **Frontend (`MembersPage.tsx`)**: form thêm member có thêm khối "Login account" — username tự điền từ email (có thể sửa tay), password tự sinh ngẫu nhiên 10 ký tự (nút refresh để sinh lại). Sau khi tạo thành công có tài khoản, dialog chuyển sang màn hình hiển thị username/password kèm nút Copy (vì password không thể xem lại sau đó). Card mỗi member hiện badge "username" (có tài khoản) hoặc "No account" (chưa có)
- [x] **Đã test**: tạo member kèm tài khoản qua proxy `/api`, đăng nhập ngay bằng tài khoản vừa tạo thành công (JWT có đúng `member_id`); trùng username trả 409 đúng; `pytest` 14/14 vẫn pass

### Phase 13f — Borrow Wizard (3 bước) + thông báo realtime cho admin ✅ DONE
(người dùng yêu cầu phân tích mượn sách theo hướng sản phẩm — có thời gian mượn/trả, nội quy, xác nhận rõ ràng; kèm yêu cầu thông báo realtime cho admin khi member tự mượn)
- [x] **Phân tích sản phẩm**: luồng cũ mượn sách là 1 hành động mù mờ (không thấy hạn trả trước, không có nội quy, không xác nhận, không có màn hình kết quả). Redesign theo mẫu Libby/OverDrive, Amazon checkout: wizard 3 bước — (1) Người mượn, (2) Xem lại & Nội quy (có checkbox đồng ý), (3) Xác nhận (biên nhận mượn sách)
- [x] **Backend — nguồn sự thật cho nội quy**: `GET /loans/policy` (public) trả `loan_period_days`, `max_active_loans_per_member`, `late_fee_per_day`, `currency` — tránh hardcode "14 ngày" rải rác ở frontend như trước. `services/loans.py` thêm `get_policy()`
- [x] **Backend — thông báo realtime qua Redis Pub/Sub + WebSocket** (`app/notifications.py`, `app/routers/notifications.py`): khi member (không phải admin mượn hộ) tự mượn sách thành công, publish message JSON vào kênh Redis `notifications:admin`. Endpoint `GET /ws/notifications?token=...` (admin only, xác thực JWT qua query param vì WebSocket browser gốc không gửi được header) subscribe kênh này và forward tới client gần như tức thời. Dùng `redis.asyncio` client riêng (client sync sẽ block event loop nếu dùng trực tiếp trong websocket handler)
- [x] **Frontend — Borrow Wizard** (`src/components/BorrowWizard.tsx`): step indicator, book summary card, chọn độc giả (admin) / hiển thị số phiếu đang mượn của chính mình (member), tính sẵn ngày mượn/hạn trả, hiển thị nội quy đầy đủ, checkbox bắt buộc đồng ý mới cho submit, màn hình xác nhận dạng "biên nhận" (mã phiếu, badge trạng thái Active, hạn trả). Dùng chung cho cả admin lẫn member, thay thế dialog mượn đơn giản cũ và nút mượn 1-click của member
- [x] **Frontend — chuông thông báo** (`src/hooks/useAdminNotifications.ts`, `src/components/NotificationBell.tsx`): kết nối WebSocket khi đăng nhập admin, tự reconnect sau 3s nếu mất kết nối, hiện toast + badge số chưa đọc trên icon chuông ở sidebar footer, dropdown liệt kê tối đa 20 thông báo gần nhất
- [x] **`vite.config.ts`**: thêm proxy `/ws` với `ws: true` để WebSocket hoạt động qua dev server
- [x] **Đã test qua Node WebSocket client thật** (không phải giả lập): admin mở kết nối `/ws/notifications` → member tự mượn sách qua API → admin nhận message trong cùng vòng request, xác nhận qua cả cổng backend trực tiếp lẫn qua proxy Vite. `pytest` 14/14 vẫn pass sau các thay đổi
- [ ] **Chưa làm**: xác minh trực quan wizard + chuông thông báo trên trình duyệt thật (vẫn không có browser tool trong môi trường này — đã test đầy đủ ở tầng API/WebSocket nhưng chưa thấy giao diện thực tế render ra sao)

### Phase 13g — Click thông báo mở thẳng phiếu mượn ✅ DONE
- [x] **Backend**: `GET /loans/{loan_id}` (`LoanDetailOut`) — trả chi tiết đầy đủ: thông tin sách (title, cover, authors), thông tin độc giả (tên, email), ngày mượn/hạn trả/ngày trả, và `status` tính động (`active`/`overdue`/`returned`, so sánh `due_date` với thời điểm hiện tại). Phân quyền giống `return`: admin xem mọi phiếu, member chỉ xem phiếu của chính mình (403 nếu không phải), 404 nếu không tồn tại
- [x] **Frontend**: `LoanDetailDialog.tsx` (dùng chung toàn app) — hiển thị đầy đủ như trên kèm nút "Mark as returned" nếu chưa trả. `NotificationBell` giờ mỗi thông báo là 1 button bấm được: bấm vào → đóng popover → mở `LoanDetailDialog` **ngay tại chỗ** (không cần điều hướng trang, dialog gắn ở `AppLayout` nên mở được từ bất kỳ trang nào admin đang xem). Đồng thời gắn thêm click-to-open cho từng dòng trong bảng ở `LoansPage` (admin) và `MyLoansPage` (member) để nhất quán — bấm dòng mở chi tiết, bấm riêng nút "Return" vẫn trả sách trực tiếp (có `stopPropagation` để 2 hành động không xung đột)
- [x] **Đã test qua Node WebSocket client thật, mô phỏng đúng hành vi click**: nhận notification → lấy `loan_id` từ payload → gọi `GET /loans/{loan_id}` qua proxy → nhận đúng chi tiết phiếu vừa tạo. `pytest` 15/15 pass (thêm test cho endpoint mới: admin xem được, chủ phiếu xem được, member khác bị chặn 403, phiếu không tồn tại → 404)

---

### Phase 13h — Avatar thật cho member + phân trang Stats + sửa lỗi WebSocket treo server ✅ DONE
- [x] **Migration 0005**: thêm cột `members.avatar_url` (nullable text)
- [x] **Backend**: `Member` model, `MemberCreate`/`MemberOut`, `MeOut`, `LoanMemberInfo` đều thêm `avatar_url`. `POST /members` nhận `avatar_url` tuỳ chọn khi tạo thủ công
- [x] **Seed — 10 user mẫu có avatar người thật**: mở rộng `seed.py` từ 3 lên 10 member, mỗi người có avatar từ **pravatar.cc** (ảnh khuôn mặt người thật được cấp phép sẵn cho mục đích placeholder/demo — chủ động tránh dùng ảnh người thật ngoài đời không có sự đồng ý) và tài khoản đăng nhập riêng (`username`/`member123`)
- [x] **Frontend**: `MembersPage` và `LoanDetailDialog` hiển thị `AvatarImage` (ảnh thật) thay vì chỉ chữ viết tắt, fallback về initials nếu không có avatar
- [x] **Stats phân trang**: `GET /stats/top-books` và `/stats/active-members` đổi sang trả `Page[dict]` (10 dòng/trang thay vì trả hết); `StatsPage.tsx` có `PaginationBar` riêng cho từng bảng, độc lập nhau
- [x] **Bug nghiêm trọng phát hiện & sửa**: `routers/notifications.py` (WebSocket) chỉ lắng nghe Redis pub/sub để gửi tin, không có task nào canh việc client ngắt kết nối — khiến uvicorn treo vĩnh viễn khi cố reload/shutdown lúc có kết nối WebSocket đang mở (chính là nguyên nhân server không phản hồi giữa phiên làm việc). Sửa bằng pattern chuẩn: 2 task chạy song song (`forward_messages` gửi tin, `watch_disconnect` canh `receive()`), dùng `asyncio.wait(..., FIRST_COMPLETED)` để hễ 1 trong 2 kết thúc thì huỷ task còn lại và dọn dẹp pubsub sạch sẽ
- [x] **Dọn dữ liệu test tích luỹ**: sau nhiều vòng test thủ công qua session, DB tích luỹ tới 297 member rác ("Concurrency Tester...") và 89 sách rác ("...Test Book", "Clean Architecture" trùng lặp) — đã xoá sạch bằng SQL trực tiếp (xoá đúng thứ tự FK: loans → book_copies/book_authors → users → audit_log → members/books), **giữ nguyên** 1 member do người dùng tự tạo qua UI thật (`kienquoc@gmail.com`) vì đó là dữ liệu thật không phải rác
- [x] **Đã test**: `pytest` 15/15 pass sau toàn bộ thay đổi; xác nhận avatar trả đúng qua API thật; backend hết treo sau khi sửa WebSocket

### Phase 13i — Test suite tự dọn dẹp (sửa tận gốc việc tích rác) ✅ DONE
(người dùng yêu cầu xoá user test — dọn tay 2 lần trong 1 phiên là dấu hiệu cần sửa tận gốc thay vì lặp lại thủ công)
- [x] **`tests/conftest.py`**: thêm fixture `_cleanup_after_session` (`scope="session"`, `autouse=True`) — sau khi TOÀN BỘ test trong phiên `pytest` chạy xong, tự động xoá theo đúng thứ tự FK mọi member/book khớp pattern do chính test suite tạo ra (`concurrency_tester%`, `other_%`, `%proxytest%`, `%testuser%` cho member; `%Test Book%`, `'Clean Architecture'` cho book) — **không đụng** tới dữ liệu seed thật hay dữ liệu người dùng tự tạo qua UI
- [x] **Đã test**: chạy `pytest` liên tiếp 2 lần, sau mỗi lần số member/book quay về đúng baseline (11 member, 4 book) — không còn tích luỹ rác qua các lần chạy như trước

### Phase 13j — 10 sách CNTT mẫu (cover dùng chung) + bảng Loans hiển thị trực quan ✅ DONE
(người dùng yêu cầu seed thêm sách CNTT dùng chung 1 ảnh bìa, và bảng Loans admin đang hiện `#id` thô cho cột copy/member — khó đọc)
- [x] **Seed**: `seed.py` thêm 12 tác giả CNTT thật (Robert C. Martin, Cormen, Kurose, Silberschatz, Russell, Kernighan & Ritchie, Freeman, McDowell...) và 10 sách CNTT (Clean Code, Pragmatic Programmer, Intro to Algorithms, Computer Networking, OS Concepts, Database System Concepts, AI Modern Approach, The C Programming Language, Head First Design Patterns, Cracking the Coding Interview) — toàn bộ dùng chung `cover_url` lấy động từ sách "Cho tôi xin một vé đi tuổi thơ" (không hardcode tên file) theo đúng yêu cầu người dùng
- [x] **Backend — enrich `GET /loans`**: trước đó chỉ trả `book_copy_id`/`member_id` thô. Giờ join thêm `books`/`members` (cả nhánh ORM cho status `borrowed`/`returned` lẫn nhánh raw-SQL trên view `v_overdue_loans` cho status `overdue`, join ngược lại bảng `loans` vì view thiếu `borrowed_at`) để trả kèm `book_title`, `book_cover_url`, `member_full_name`, `member_avatar_url` (`app/routers/loans.py`)
- [x] **Frontend**: `LoansPage` (admin) và `MyLoansPage` (member) thay cột "Copy"/"Member" hiển thị `#id` thô bằng component `BookCell` (ảnh bìa thu nhỏ + tên sách) và `MemberCell` (avatar + tên, chỉ ở trang admin) — mã phiếu `#id` vẫn giữ làm badge tham chiếu nhỏ, không còn là cột chính. `types.ts` cập nhật `Loan`/`OverdueLoan` thêm các field mới
- [x] **Đã test**: `pytest` 15/15 pass; xác nhận qua API thật (VD loan #237: kienquoc mượn "Clean Code") trả đúng field enrich; `tsc -b` + `oxlint` sạch

### Phase 13k — Đồng bộ pagination footer toàn bộ trang danh sách ✅ DONE
(người dùng gửi ảnh tham khảo 1 bảng dữ liệu chuẩn — Search/Filters/Add/Columns + footer "Rows [n] · Page X of Y · first/prev/next/last" — yêu cầu rà soát và đồng bộ hoá các thành phần bảng trong toàn app)
- [x] **`PaginationBar.tsx`** viết lại: thêm dropdown **Rows per page** (tuỳ chọn qua props `pageSize`/`pageSizeOptions`/`onPageSizeChange`), nhãn **"Page X of Y"**, và 4 nút điều hướng **First/Previous/Next/Last** (thay vì dãy số trang rời rạc như bản cũ). Footer giờ luôn hiển thị kể cả khi bảng đang rỗng (khớp hành vi ảnh mẫu "0-0/0 · Page 1 of 1"), thay vì ẩn khi `items.length === 0`
- [x] Áp dụng đồng bộ cho toàn bộ nơi có bảng phân trang: **Books** (giữ cố định 10/trang để không phá lưới 5×2 đã chốt ở Phase 13c, nhưng vẫn có First/Last + Page X of Y), **Members** (rows 9/18/36), **Loans** & **My Loans** (cả 2 tab Active/Overdue, rows 10/20/50), **Stats** (2 bảng Top books & Active members, mỗi bảng rows riêng)
- [x] **Đã test**: `tsc -b` và `oxlint` sạch; dev server compile đúng qua Vite proxy cho toàn bộ file đã sửa
- [x] **Chưa làm ở lúc chốt phase, giờ đã làm ở Phase 13l**: Search cho `CategoriesPage`, Search cho `LoansPage`. Vẫn còn thiếu: nút "Filters"/"Columns" kiểu popover cho Members/Loans/Categories (chỉ Books có); checkbox chọn nhiều dòng (bulk actions); xác minh trực quan trên trình duyệt thật

### Phase 13l — Hoàn thiện các mục UI còn sót: chọn tác giả, quản lý bản sao, search Categories/Loans, build-test Docker frontend ✅ DONE
(người dùng yêu cầu "hoàn thiện phần UI cho xong luôn" — dọn nốt các mục còn `[ ]` trong checklist UI)
- [x] **Chọn tác giả khi tạo/sửa sách**: backend `POST /books`/`PUT /books/{id}` vốn đã nhận `author_ids` (chỉ chưa có UI). `BooksPage.tsx` giờ fetch `GET /authors`, hiển thị danh sách checkbox nhiều cột trong dialog tạo/sửa sách, gửi kèm `author_ids` khi submit
- [x] **Giảm số bản sao qua UI (đúng nghiệp vụ, không xoá row)**: thêm 2 endpoint backend — `GET /books/{id}/copies` (liệt kê từng bản sao + status), `PATCH /books/{id}/copies/{copy_id}` (đổi status `available`↔`lost`/`damaged`, chặn đổi status bản sao đang `borrowed` → 409, giữ nguyên FK tới `loans` nên không mất audit trail). Dialog sửa sách ở frontend thêm mục "Manage copies" liệt kê từng bản sao kèm nút "Mark damaged/lost" / "Restore"
- [x] **Search cho `CategoriesPage`**: lọc client-side theo tên (danh mục thường ít, không cần round-trip backend)
- [x] **Search cho `LoansPage` (admin)**: thêm tham số `search` ở `GET /loans` (backend) — lọc theo `book.title ILIKE` hoặc `member.full_name ILIKE`, áp dụng cho cả nhánh ORM (`borrowed`/`returned`) lẫn nhánh raw-SQL trên view `v_overdue_loans` (nhánh `overdue`, phải join thêm `books`/`members` vào cả câu đếm `total` lẫn câu lấy dữ liệu). Frontend thêm ô Search debounce 300ms cạnh nút sort
- [x] **Build-test Docker cho service `frontend`**: `docker compose up -d --build frontend` build image thành công (1.22GB, dùng `node:22-slim`, không lỗi). Container không start được trên máy dev vì cổng 5173 đang bị chiếm bởi tiến trình `npm run dev` chạy trên host (không phải lỗi Dockerfile) — đã dọn container thử nghiệm, các service khác (postgres/redis/backend) không bị ảnh hưởng
- [x] **Đã test**: `pytest` 15/15 pass; `tsc -b` + `oxlint` sạch; xác nhận qua API thật qua proxy `/api` (list authors, list/patch copies, patch bị chặn 409 khi copy đang borrowed, search loans theo tên sách "clean" và tên member "A" đều trả đúng kết quả)
- [ ] **Chưa làm** (cân nhắc bỏ qua vì không phải trọng tâm chấm điểm CSDL): nút Filters/Columns kiểu popover cho Members/Loans/Categories; checkbox bulk-select trên bảng; xác minh trực quan trên trình duyệt thật (môi trường này không có browser tool)

## Cách cập nhật file này
- Sau khi hoàn thành công việc trong 1 phase (dù chỉ một phần), tick checkbox tương ứng ngay, không đợi xong hoàn toàn phase mới cập nhật.
- Luôn cập nhật mục "Trạng thái hiện tại" ở đầu file trước khi kết thúc session.
- Nếu phát hiện lệch giữa PLAN và code thực tế khi bắt đầu session mới, sửa PLAN theo code thực tế — code luôn là nguồn sự thật cuối cùng.
