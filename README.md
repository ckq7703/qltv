# QLTV — Hệ Thống Quản Lý Thư Viện

Hệ thống quản lý thư viện trọn gói: quản lý đầu sách và từng bản sao vật lý, độc giả, mượn/trả sách, theo dõi quá hạn và thống kê. Được xây dựng trên nền CSDL chuẩn hóa, xử lý mượn sách đồng thời an toàn ở tầng database, và có kiểm thử cùng benchmark đi kèm.

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.12-009688?logo=fastapi&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![React](https://img.shields.io/badge/React-Vite%20%2B%20TypeScript-61DAFB?logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

## Mục lục

- [Tính năng và điểm nổi bật](#tính-năng-và-điểm-nổi-bật)
- [Chống mượn trùng sách khi nhiều người mượn cùng lúc](#chống-mượn-trùng-sách-khi-nhiều-người-mượn-cùng-lúc)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Kiến trúc](#kiến-trúc)
- [Triển khai bằng Docker](#triển-khai-bằng-docker)
- [Chạy không dùng Docker (tuỳ chọn)](#chạy-không-dùng-docker-tuỳ-chọn)
- [Tài khoản dùng thử](#tài-khoản-dùng-thử)
- [Kiểm thử](#kiểm-thử)
- [Thiết kế CSDL](#thiết-kế-csdl)
- [Danh sách API](#danh-sách-api)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Tài liệu liên quan](#tài-liệu-liên-quan)
- [Xử lý sự cố](#xử-lý-sự-cố)

## Tính năng và điểm nổi bật

| Chủ đề | Nội dung |
|---|---|
| **Chuẩn hóa schema** | Mỗi bản sao vật lý của sách là một dòng trong `book_copies`, không đếm `total_copies`/`available_copies` thô trong bảng `books`. Quan hệ nhiều-nhiều sách–tác giả qua `book_authors`, danh mục phân cấp qua `parent_id`. |
| **Chống mượn trùng sách** | Khi nhiều người bấm mượn cùng lúc cho cuốn sách chỉ còn 1 bản, hệ thống đảm bảo chỉ 1 người mượn được, những người còn lại nhận thông báo hết sách. Xem giải thích ở mục [Chống mượn trùng sách khi nhiều người mượn cùng lúc](#chống-mượn-trùng-sách-khi-nhiều-người-mượn-cùng-lúc). |
| **Trigger** | Cập nhật trạng thái bản sao khi mượn/trả, ghi audit log cho `books` và `loans`, tự cập nhật `search_vector` cho tìm kiếm toàn văn. |
| **View / Materialized view** | `v_top_borrowed_books`, `v_overdue_loans`, `v_active_members`, `mv_monthly_stats`. |
| **Index** | GIN full-text search (`idx_books_search`), partial index cho phiếu mượn đang mở (`idx_loans_open`), cùng các index theo danh mục, độc giả, trạng thái bản sao. Có kết quả `EXPLAIN ANALYZE` trong [docs/BENCHMARKS.md](docs/BENCHMARKS.md). |
| **Cache-aside** | Redis cache kết quả tìm kiếm sách (TTL 60 giây), có thống kê hit/miss qua API. |
| **Xác thực & phân quyền** | JWT access/refresh token, hai vai trò `admin` và `member`. Độc giả tự mượn/trả sách (self-service). |
| **Thông báo realtime** | Admin nhận thông báo qua WebSocket khi độc giả tự mượn sách. |
| **Tái lập DB từ đầu** | Toàn bộ trigger, function, view và index được định nghĩa trong Alembic migration; `alembic upgrade head` trên DB rỗng dựng lại đầy đủ schema. |

## Chống mượn trùng sách khi nhiều người mượn cùng lúc

**Vấn đề.** Thư viện còn đúng 1 cuốn "Foundation". Hai độc giả A và B cùng bấm "Mượn" trong cùng một khoảnh khắc. Nếu hệ thống chỉ làm theo kiểu "xem còn sách không, còn thì cho mượn", cả hai đều thấy "còn 1 cuốn" và cả hai đều mượn được. Kết quả là một cuốn sách được cho hai người mượn.

**Cách hệ thống giải quyết.** Mỗi cuốn sách vật lý là một dòng riêng trong bảng `book_copies`. Khi có yêu cầu mượn, cơ sở dữ liệu tìm một bản sao còn rảnh và **khoá dòng đó lại** cho đến khi việc mượn hoàn tất. Người đến sau không chờ và không tranh cùng một dòng: họ bỏ qua dòng đang bị khoá, tìm bản sao khác, và nếu không còn bản nào thì nhận thông báo hết sách.

```
A và B cùng bấm "Mượn" (còn 1 bản sao)

  A ──► khoá bản sao #1 ──► tạo phiếu mượn ──► xong        ──► thành công
  B ──► bản sao #1 đang bị khoá, bỏ qua ──► không còn bản nào ──► báo "hết sách"
```

**Cách làm kỹ thuật.** Toàn bộ các bước (tìm bản sao, khoá, tạo phiếu, đổi trạng thái) nằm trong một transaction ở tầng cơ sở dữ liệu, dùng `SELECT ... FOR UPDATE SKIP LOCKED` của PostgreSQL. Việc chống trùng do database đảm bảo, không dựa vào code ứng dụng, nên vẫn đúng dù chạy nhiều tiến trình backend cùng lúc. Mã nguồn nằm ở [backend/app/services/loans.py](backend/app/services/loans.py).

**Kết quả kiểm chứng.** Test tự động gửi 10 yêu cầu mượn cùng lúc cho một cuốn sách chỉ còn 1 bản. Kết quả: đúng 1 yêu cầu thành công (`201`), 9 yêu cầu còn lại nhận `409` (hết sách), không có lỗi hệ thống hay treo. Chạy lại bằng lệnh ở mục [Kiểm thử](#kiểm-thử).

## Công nghệ sử dụng

- **Backend:** Python 3.12, FastAPI, SQLAlchemy, Alembic, Uvicorn
- **CSDL:** PostgreSQL 16
- **Cache:** Redis 7
- **Frontend:** React, Vite, TypeScript, Tailwind CSS v4, shadcn/ui (bản `@base-ui/react`)
- **Hạ tầng:** Docker, Docker Compose

## Kiến trúc

```
┌──────────────┐   /api, /ws (proxy)   ┌──────────────┐        ┌──────────────┐
│   Frontend   │ ────────────────────► │   Backend    │ ─────► │  PostgreSQL  │
│ React + Vite │                       │   FastAPI    │        │  (nguồn sự   │
│    :5173     │ ◄──────────────────── │    :8000     │        │   thật) :5432│
└──────────────┘                       └──────┬───────┘        └──────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │    Redis     │
                                       │ cache-aside  │
                                       │    :6379     │
                                       └──────────────┘
```

Toàn bộ logic nghiệp vụ nằm ở backend; việc chống mượn trùng sách được database đảm bảo bằng transaction chứ không chỉ dựa vào code ứng dụng. Chi tiết xem [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Triển khai bằng Docker

### Yêu cầu

- [Docker](https://docs.docker.com/get-docker/) 24 trở lên (Docker Desktop trên Windows/macOS)
- Docker Compose v2 (đi kèm Docker Desktop; kiểm tra bằng `docker compose version`)
- Các cổng **5173**, **8000**, **5432**, **6379** đang trống (có thể đổi trong `.env`)

### Các service

| Service | Image / Build | Cổng | Vai trò |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | CSDL chính, volume `postgres_data`, có healthcheck |
| `redis` | `redis:7-alpine` | 6379 | Cache, volume `redis_data`, có healthcheck |
| `backend` | build từ `./backend` | 8000 | FastAPI (Uvicorn, chế độ `--reload`), chờ `postgres` và `redis` healthy mới khởi động |
| `frontend` | build từ `./frontend` | 5173 | Vite dev server, proxy `/api` và `/ws` tới `backend` |

### Bước 1: Lấy mã nguồn

```bash
git clone https://github.com/ckq7703/qltv.git
cd qltv
```

### Bước 2: Tạo file cấu hình `.env`

```bash
# Linux / macOS / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Mở `.env` và **đổi các giá trị mặc định**, tối thiểu là `POSTGRES_PASSWORD` và `JWT_SECRET`. Nếu đổi mật khẩu, nhớ cập nhật cùng giá trị trong `DATABASE_URL`.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `qltv_user` / `change_me` / `qltv` | Thông tin đăng nhập và tên DB |
| `POSTGRES_PORT` | `5432` | Cổng PostgreSQL trên máy host |
| `DATABASE_URL` | `postgresql://qltv_user:change_me@postgres:5432/qltv` | Chuỗi kết nối dùng bên trong mạng Docker (host là `postgres`) |
| `REDIS_PORT` / `REDIS_URL` | `6379` / `redis://redis:6379/0` | Cấu hình Redis |
| `JWT_SECRET` | `change_me_to_a_random_secret` | Khoá ký JWT, **bắt buộc đổi** khi triển khai thật |
| `JWT_ALGORITHM` | `HS256` | Thuật toán ký |
| `JWT_ACCESS_TTL_MINUTES` / `JWT_REFRESH_TTL_DAYS` | `30` / `7` | Thời hạn access/refresh token |
| `BACKEND_PORT` / `FRONTEND_PORT` | `8000` / `5173` | Cổng công bố ra máy host |

Sinh nhanh một `JWT_SECRET` ngẫu nhiên:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Bước 3: Build và khởi động toàn bộ stack

```bash
docker compose up -d --build
docker compose ps
```

Chờ đến khi `postgres` và `redis` hiển thị `healthy` và bốn container đều `Up`.

### Bước 4: Áp dụng migration

Lệnh khởi động backend **không tự chạy migration**, nên cần chạy thủ công ở lần đầu (và sau mỗi lần reset volume):

```bash
docker compose exec backend alembic upgrade head
```

Bước này tạo bảng, trigger, function, view, materialized view và index.

### Bước 5: Nạp dữ liệu mẫu

```bash
docker compose exec backend python -m app.seed
```

Dữ liệu mẫu gồm danh mục, tác giả, sách kèm bản sao, độc giả, phiếu mượn (có phiếu quá hạn) và tài khoản dùng thử. Script seed chạy lặp lại được. Bỏ qua bước này nếu bạn muốn bắt đầu với hệ thống trống, khi đó cần tự tạo tài khoản quản trị đầu tiên.

### Bước 6: Truy cập ứng dụng

| Thành phần | Địa chỉ |
|---|---|
| Giao diện web | http://localhost:5173 |
| API backend | http://localhost:8000 |
| Swagger UI (tài liệu API tương tác) | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

### Quản lý stack hằng ngày

```bash
docker compose logs -f backend      # xem log (hoặc frontend, postgres, redis)
docker compose stop                 # dừng, giữ dữ liệu
docker compose start                # chạy lại sau khi stop
docker compose down                 # dừng và xoá container, giữ volume dữ liệu
docker compose up -d --build        # build lại image sau khi đổi Dockerfile/requirements
```

Truy cập trực tiếp vào dịch vụ trong container:

```bash
docker compose exec postgres psql -U qltv_user -d qltv   # psql (đổi user/db theo .env)
docker compose exec redis redis-cli                       # redis-cli
```

> **Reset hoàn toàn dữ liệu** (xoá toàn bộ DB và Redis):
>
> ```bash
> docker compose down -v
> ```
>
> Sau đó lặp lại Bước 3 đến Bước 5. Lệnh này **không thể hoàn tác**.

### Ghi chú về chế độ chạy

`docker-compose.yml` hiện cấu hình cho **môi trường phát triển**: mã nguồn `./backend` và `./frontend` được mount vào container, backend chạy với `--reload`, frontend chạy Vite dev server, nên sửa code trên máy host sẽ có hiệu lực ngay. Khi triển khai production cần bổ sung: bỏ `--reload` và các volume mount mã nguồn, build frontend thành static (`npm run build`) rồi phục vụ qua Nginx, không công bố cổng 5432/6379 ra ngoài, và dùng bí mật riêng cho `POSTGRES_PASSWORD`, `JWT_SECRET`.

## Chạy không dùng Docker (tuỳ chọn)

Chỉ cần thiết khi muốn phát triển ngoài container. Vẫn cần PostgreSQL 16 và Redis 7 đang chạy (có thể dùng `docker compose up -d postgres redis`).

**Backend** (Python 3.12):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Đặt DATABASE_URL, REDIS_URL, JWT_SECRET... trong môi trường, host là localhost thay vì postgres/redis
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

**Frontend** (Node.js 20 trở lên):

```bash
cd frontend
npm install
npm run dev
```

Khi chạy ngoài Docker, đặt biến `VITE_API_PROXY_TARGET=http://localhost:8000` để Vite proxy đúng tới backend.

## Tài khoản dùng thử

Các tài khoản này do `app.seed` tạo, chỉ dành cho môi trường phát triển và dùng thử.

| Vai trò | Tên đăng nhập | Mật khẩu | Quyền |
|---|---|---|---|
| Admin | `admin` | `admin123` | Quản lý sách, bản sao, độc giả, danh mục, phiếu mượn, thống kê |
| Member | xem danh sách trong [backend/app/seed.py](backend/app/seed.py) | `member123` | Xem sách, tự mượn/trả sách, xem phiếu mượn của mình |

Hãy xoá hoặc đổi mật khẩu các tài khoản này trước khi triển khai ở bất kỳ môi trường nào ngoài máy cá nhân.

## Kiểm thử

Chạy trong container backend (stack cần đang chạy và đã migrate + seed):

```bash
docker compose exec backend pytest -v
```

Chỉ chạy test mượn sách đồng thời (10 yêu cầu cùng lúc cho 1 bản sao cuối cùng):

```bash
docker compose exec backend pytest tests/test_concurrency.py -v
```

Bộ test gồm: CRUD và tìm kiếm sách, mượn/trả sách, **10 yêu cầu mượn đồng thời cho 1 bản sao cuối cùng**, và phân quyền self-service của độc giả. Test tự dọn dữ liệu phát sinh sau mỗi phiên chạy.

## Thiết kế CSDL

Các bảng: `users`, `members`, `authors`, `categories`, `books`, `book_authors`, `book_copies`, `loans`, `audit_log`.

**Trigger và function**

| Trigger | Tác dụng |
|---|---|
| `trg_after_loan_insert` | Chuyển bản sao sang trạng thái đang mượn khi tạo phiếu |
| `trg_after_loan_return` | Trả bản sao về trạng thái sẵn sàng khi phiếu được trả |
| `trg_audit_books`, `trg_audit_loans` | Ghi lịch sử thay đổi vào `audit_log` |
| `trg_books_search_vector_update` | Duy trì `search_vector` phục vụ tìm kiếm toàn văn |

**View**

`v_top_borrowed_books` (sách mượn nhiều nhất), `v_overdue_loans` (phiếu quá hạn), `v_active_members` (độc giả tích cực), `mv_monthly_stats` (thống kê theo tháng, làm mới qua `POST /stats/refresh-monthly`).

**Kết quả benchmark tiêu biểu** (20.000 sách, tìm kiếm toàn văn): có GIN index, planner dùng `Bitmap Index Scan` (2,41 ms); không có index, phải `Seq Scan` toàn bảng (4,58 ms). Số liệu đầy đủ và cách tái lập nằm ở [docs/BENCHMARKS.md](docs/BENCHMARKS.md).

Chi tiết thiết kế và lý do chọn chiến lược khoá: [docs/DATABASE.md](docs/DATABASE.md).

## Danh sách API

Tài liệu tương tác đầy đủ tại http://localhost:8000/docs. Tóm tắt:

| Nhóm | Endpoint chính |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Books | `GET/POST /books`, `PUT/DELETE /books/{id}`, `GET/POST /books/{id}/copies`, `PATCH /books/{id}/copies/{copy_id}` |
| Authors | `GET/POST /authors` |
| Categories | `GET/POST /categories`, `PUT/DELETE /categories/{id}` |
| Members | `GET/POST /members` |
| Loans | `GET /loans`, `GET /loans/policy`, `POST /loans/borrow`, `POST /loans/{id}/return`, `GET /loans/{id}` |
| Stats | `GET /stats/top-books`, `GET /stats/active-members`, `POST /stats/refresh-monthly` |
| Uploads | `POST /uploads/cover` |
| Realtime | WebSocket `/ws/notifications` (thông báo cho admin) |

## Cấu trúc thư mục

```
QLTV/
├── backend/
│   ├── app/
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── routers/       # FastAPI routers
│   │   ├── services/      # Nghiệp vụ (mượn/trả với FOR UPDATE SKIP LOCKED)
│   │   ├── cache/         # Redis client, cache-aside
│   │   └── seed.py        # Dữ liệu mẫu
│   ├── migrations/        # Alembic (schema, trigger, view, index)
│   ├── tests/             # pytest, gồm test mượn sách đồng thời
│   └── Dockerfile
├── frontend/              # React + Vite + TypeScript + shadcn/ui
├── docs/                  # ARCHITECTURE, DATABASE, BENCHMARKS
├── docker-compose.yml
├── .env.example
└── library-system-spec.md # Đặc tả hệ thống
```

## Tài liệu liên quan

- [library-system-spec.md](library-system-spec.md): đặc tả và phân tích hệ thống
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): kiến trúc hệ thống
- [docs/DATABASE.md](docs/DATABASE.md): thiết kế CSDL, chiến lược khoá
- [docs/BENCHMARKS.md](docs/BENCHMARKS.md): kết quả `EXPLAIN ANALYZE`, test mượn sách đồng thời, cache

## Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp và cách xử lý |
|---|---|
| `port is already allocated` | Cổng bị chiếm. Đổi `POSTGRES_PORT`, `REDIS_PORT`, `BACKEND_PORT` hoặc `FRONTEND_PORT` trong `.env` rồi `docker compose up -d`. |
| API trả lỗi `relation ... does not exist` | Chưa chạy migration. Chạy `docker compose exec backend alembic upgrade head`. |
| Đăng nhập không được, danh sách trống | Chưa nạp dữ liệu mẫu. Chạy `docker compose exec backend python -m app.seed`. |
| Backend không kết nối được DB sau khi đổi mật khẩu | Volume Postgres giữ mật khẩu cũ. Đảm bảo `DATABASE_URL` khớp `POSTGRES_PASSWORD`; nếu vẫn lỗi và chấp nhận mất dữ liệu, chạy `docker compose down -v` rồi dựng lại. |
| Trang web trắng hoặc không gọi được API | Xem `docker compose logs frontend backend`. Kiểm tra `VITE_API_PROXY_TARGET` trỏ đúng backend. |
| Container frontend không thấy package mới | `node_modules` nằm trong volume riêng. Chạy `docker compose up -d --build frontend`, hoặc `docker compose down` rồi xoá volume `frontend_node_modules` nếu cần. |
