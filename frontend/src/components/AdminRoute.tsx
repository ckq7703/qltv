import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()
  if (role !== 'admin') {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
