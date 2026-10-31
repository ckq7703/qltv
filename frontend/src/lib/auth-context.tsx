import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  clearTokens,
  decodeAccessToken,
  getAccessToken,
  getRefreshToken,
  setTokens,
  api,
  type JwtClaims,
} from '@/lib/api'
import type { UserRole } from '@/types'

// Dữ liệu và hành động xác thực mà mọi component lấy được qua useAuth().
interface AuthState {
  isAuthenticated: boolean
  role: UserRole | null
  memberId: number | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// Đọc claims từ access token đang lưu. Không có token, token hỏng hoặc đã hết hạn thì trả null.
function readClaims(): JwtClaims | null {
  const token = getAccessToken()
  if (!token) return null
  const claims = decodeAccessToken(token)
  if (!claims || claims.exp * 1000 < Date.now()) return null
  return claims
}

// Cấp trạng thái đăng nhập cho cả app. Khởi tạo từ localStorage nên F5 trang vẫn giữ đăng nhập.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<JwtClaims | null>(() => readClaims())

  // Đăng nhập: gọi API, lưu token rồi cập nhật claims.
  const login = async (username: string, password: string) => {
    const resp = await api.post('/auth/login', { username, password })
    const { access_token, refresh_token } = resp.data
    setTokens(access_token, refresh_token)
    setClaims(readClaims())
  }

  // Đăng xuất: báo backend thu hồi refresh token, rồi xóa token ở máy.
  const logout = async () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refresh_token: refreshToken })
      } catch {
        // Best-effort — vẫn xoá token local dù request logout thất bại.
      }
    }
    clearTokens()
    setClaims(null)
  }

  const value = useMemo(
    () => ({
      isAuthenticated: claims !== null,
      role: claims?.role ?? null,
      memberId: claims?.member_id ?? null,
      login,
      logout,
    }),
    [claims],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook lấy trạng thái đăng nhập; chỉ dùng được bên trong AuthProvider.
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
