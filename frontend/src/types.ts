export interface Author {
  id: number
  full_name: string
}

export interface Category {
  id: number
  name: string
  parent_id: number | null
}

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

export interface TopBook {
  id: number
  title: string
  times_borrowed: number
  rank: number
}

export interface ActiveMember {
  id: number
  full_name: string
  total_loans: number
  activity_rank: number
}

export interface CacheStats {
  hits: number
  misses: number
  hit_ratio: number
}

export type UserRole = 'admin' | 'member'

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface LoanPolicy {
  loan_period_days: number
  max_active_loans_per_member: number
  late_fee_per_day: number
  currency: string
}

export interface BookBorrowedNotification {
  type: 'book_borrowed'
  loan_id: number
  book_title: string
  member_name: string
  due_date: string
  occurred_at: string
}

export type LoanStatus = 'active' | 'overdue' | 'returned'

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
