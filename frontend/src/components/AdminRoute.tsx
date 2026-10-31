import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

// Bọc trang chỉ dành cho admin. Không phải admin thì chuyển về trang /login.
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()
  if (role !== 'admin') {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
