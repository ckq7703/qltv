import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

// Bọc trang cần đăng nhập (admin hoặc member). Chưa đăng nhập thì chuyển về /login.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
