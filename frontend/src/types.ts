// Kiểu dữ liệu dùng chung, khớp với JSON mà backend trả về (xem backend/app/schemas/).
export interface Author {
  id: number
  full_name: string
}

export interface Category {
  id: number
  name: string
  parent_id: number | null
}

// Sách, kèm số bản sao rảnh và tổng số bản sao (backend tính thêm).
export interface Book {
  id: number
  title: string
  isbn: string
  category_id: number | null
  cover_url: string | null
  created_at: string
  authors: Author[]
  available_copies: number
  total_copies: number
}

// Trạng thái một bản sao: rảnh / đang mượn / mất / hỏng.
export type CopyStatus = 'available' | 'borrowed' | 'lost' | 'damaged'

export interface BookCopy {
  id: number
  status: CopyStatus
}

export interface Member {
  id: number
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  joined_at: string
  username: string | null
}

// Phiếu mượn trong danh sách, kèm tên sách và thông tin độc giả để hiển thị.
export interface Loan {
  id: number
  book_copy_id: number
  member_id: number
  borrowed_at: string
  due_date: string
  returned_at: string | null
  book_title: string
  book_cover_url: string | null
  member_full_name: string
  member_avatar_url: string | null
}

// Phiếu quá hạn (từ view v_overdue_loans); overdue_by là khoảng thời gian đã trễ.
export interface OverdueLoan {
  id: number
  member_id: number
  book_id: number
  due_date: string
  overdue_by: string
  book_copy_id: number
  borrowed_at: string
  book_title: string
  book_cover_url: string | null
  member_full_name: string
  member_avatar_url: string | null
}

// Một dòng trong bảng xếp hạng sách được mượn nhiều (view v_top_borrowed_books).
export interface TopBook {
  id: number
  title: string
  times_borrowed: number
  rank: number
}

// Một dòng trong bảng xếp hạng độc giả mượn nhiều (view v_active_members).
export interface ActiveMember {
  id: number
  full_name: string
  total_loans: number
  activity_rank: number
}

// Thống kê cache Redis của tìm kiếm sách.
export interface CacheStats {
  hits: number
  misses: number
  hit_ratio: number
}

export type UserRole = 'admin' | 'member'

// Một dòng nhật ký thay đổi (GET /audit-logs). changed_by_username là null khi thay đổi
// không đi qua API (seed, SQL tay). old_data / new_data là ảnh chụp dòng trước / sau khi sửa.
export interface AuditLog {
  id: number
  table_name: 'books' | 'loans'
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  row_id: number | null
  changed_by: string | null
  changed_by_username: string | null
  changed_at: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

// Kết quả phân trang chung cho mọi danh sách.
export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Nội quy mượn sách lấy từ backend (GET /loans/policy).
export interface LoanPolicy {
  loan_period_days: number
  max_active_loans_per_member: number
  late_fee_per_day: number
  currency: string
}

// Thông báo realtime gửi tới admin khi có member tự mượn sách.
export interface BookBorrowedNotification {
  type: 'book_borrowed'
  loan_id: number
  book_title: string
  member_name: string
  due_date: string
  occurred_at: string
}

// Trạng thái phiếu: đang mượn / quá hạn / đã trả.
export type LoanStatus = 'active' | 'overdue' | 'returned'

// Chi tiết một phiếu mượn, gồm cả thông tin sách và độc giả.
export interface LoanDetail {
  id: number
  status: LoanStatus
  book_copy_id: number
  borrowed_at: string
  due_date: string
  returned_at: string | null
  book: {
    id: number
    title: string
    cover_url: string | null
    authors: string[]
  }
  member: {
    id: number
    full_name: string
    email: string
    avatar_url: string | null
  }
}
