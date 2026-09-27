# Kiến trúc kỹ thuật — QLTV

> Tài liệu này mô tả kiến trúc vận hành. Với thiết kế CSDL chi tiết (schema, trigger, view, index, transaction), xem [DATABASE.md](DATABASE.md). Với danh sách tính năng và checklist gốc, xem [../library-system-spec.md](../library-system-spec.md).

## 1. Thành phần hệ thống

| Thành phần | Vai trò | Bắt buộc? |
|---|---|---|
| PostgreSQL | Lưu trữ dữ liệu chính, nơi đặt transaction/trigger/view/index — **trọng tâm đồ án** | Bắt buộc |
| Redis | Cache tìm kiếm (cache-aside), lưu refresh token | Bắt buộc |
| FastAPI (`backend/`) | Business logic, CRUD, nghiệp vụ mượn/trả, gọi Postgres/Redis | Bắt buộc |
| React + Vite (`frontend/`) | Giao diện người dùng (UI tiếng Anh), gọi thẳng FastAPI qua `/api` (proxy dev) | Phase 13 |
| NestJS (`gateway/`) | BFF mỏng: verify JWT + forward request | Tuỳ chọn, Phase 11 |

## 1.1. Frontend (`frontend/`)

- Stack: React 19 + TypeScript + Vite + Tailwind CSS v4 + **shadcn/ui** (bản `@base-ui/react`, không phải Radix) + `react-router-dom` + `axios`.
- Layout: **sidebar** (component `Sidebar` của shadcn) chứa điều hướng, không dùng topbar. Xem `src/components/layout/AppLayout.tsx`. Sidebar chia 2 nhóm menu theo vai trò: "My Library" (member: Books, My Loans) và "Management" (admin: Books, Members, Categories, Loans, Stats).
- Auth: JWT access token lưu `localStorage`, tự động refresh qua interceptor axios khi gặp 401 (`src/lib/api.ts`). Role (`admin`/`member`) và `member_id` giải mã trực tiếp từ claims JWT phía client; `GET /auth/me` dùng khi cần thêm tên/email/avatar đầy đủ của member đang đăng nhập.
- Phân quyền route: `/` (Books) và `/my-loans` cho mọi user đã đăng nhập (bọc bởi `RequireAuth`); `/members`, `/loans`, `/categories`, `/stats` chỉ Admin (bọc bởi `AdminRoute`). Member tự mượn/trả sách qua chính API `/loans/*` (server tự khoá `member_id` theo JWT, xem `DATABASE.md`/`app/routers/loans.py`), không có route/API riêng cho member.
- **Realtime**: `GET /ws/notifications?token=...` (WebSocket, admin only) — khi member tự mượn sách, backend publish qua Redis Pub/Sub, admin nhận toast + badge chuông thông báo gần như tức thời (`src/hooks/useAdminNotifications.ts`, `src/components/NotificationBell.tsx`). Bấm vào thông báo hoặc vào 1 dòng trong bảng Loans mở thẳng `LoanDetailDialog` (chi tiết phiếu mượn, không cần điều hướng trang).
- Dev server proxy `/api/*` và `/ws` (`ws: true`) → backend (`vite.config.ts`, biến `VITE_API_PROXY_TARGET`, mặc định `http://localhost:8000`, khi chạy trong Docker trỏ `http://backend:8000`).
- shadcn component đã cài: button, input, card, table, dialog, label, select, badge, tabs, sonner (toast), dropdown-menu, separator, skeleton, sidebar, sheet, tooltip, avatar, popover, checkbox, pagination.
- Chưa dùng component `form` (react-hook-form wrapper) của shadcn — form hiện viết tay bằng `useState` cho đơn giản, đủ cho quy mô đồ án.
- Component dùng chung đáng chú ý: `PaginationBar` (footer phân trang thống nhất — rows/trang, "Page X of Y", First/Prev/Next/Last, dùng ở Books/Members/Loans/My Loans/Stats), `BookCover` (ảnh bìa hoặc placeholder gradient theo hash id), `BorrowWizard` (mượn sách 3 bước), `LoanDetailDialog` (chi tiết phiếu mượn dùng chung toàn app).

## 2. Luồng request điển hình (mượn sách)

```
Client → FastAPI /loans/borrow
           │
           ▼
   BEGIN TRANSACTION
   SELECT book_copy khả dụng ... FOR UPDATE SKIP LOCKED
   Kiểm tra giới hạn mượn (COUNT loans chưa trả của member)
   INSERT INTO loans
   (trigger tự động: UPDATE book_copies.status = 'borrowed')
   COMMIT
           │
           ▼
   Trả về 201 + thông tin phiếu mượn
```

Chi tiết transaction và cơ chế khóa: xem `DATABASE.md` mục "Concurrency control".

## 3. Cấu trúc thư mục
Xem `PLAN.md` mục "Cấu trúc thư mục mục tiêu" — đây là bản kế hoạch, cập nhật theo thực tế khi triển khai.

## 4. Biến môi trường (`.env`)

| Biến | Ý nghĩa |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Cấu hình container Postgres |
| `DATABASE_URL` | Chuỗi kết nối SQLAlchemy, VD: `postgresql://user:pass@postgres:5432/qltv` |
| `REDIS_URL` | VD: `redis://redis:6379/0` |
| `JWT_SECRET` | Khóa ký JWT access token |
| `JWT_REFRESH_TTL` | Thời hạn refresh token (giây), khớp TTL key lưu trong Redis |
| `FRONTEND_PORT` | Cổng expose dev server frontend (mặc định 5173) |

File mẫu: `.env.example` (tạo ở Phase 1, không commit `.env` thật).

## 5. Quyết định kiến trúc (ADR rút gọn)

**Vì sao tách `book_copies` thay vì đếm `available_copies`?**
Cho phép truy vết từng cuốn sách vật lý cụ thể, là điều kiện cần để minh họa khóa tương tranh ở mức row-level (`FOR UPDATE` trên 1 row `book_copies` cụ thể) thay vì khóa/tính toán ở mức đếm số nguyên — vốn dễ sai khi tương tranh.

**Vì sao trigger/view định nghĩa trong migration, không tạo tay?**
Đảm bảo toàn bộ DB (bao gồm cả logic ở tầng DB) tái lập được từ đầu bằng `alembic upgrade head`, phục vụ việc chấm điểm/tái hiện đồ án trên máy khác.

**Vì sao NestJS là tuỳ chọn?**
Đề tài là môn CSDL — thời gian nên ưu tiên cho thiết kế/vận hành tầng dữ liệu (Phase 1-10) trước, kiến trúc gateway không phải tiêu chí chấm điểm chính.
