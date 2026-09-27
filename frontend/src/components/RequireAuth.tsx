import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
