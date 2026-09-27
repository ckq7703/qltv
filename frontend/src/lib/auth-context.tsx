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

interface AuthState {
  isAuthenticated: boolean
  role: UserRole | null
  memberId: number | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function readClaims(): JwtClaims | null {
  const token = getAccessToken()
  if (!token) return null
  const claims = decodeAccessToken(token)
  if (!claims || claims.exp * 1000 < Date.now()) return null
  return claims
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<JwtClaims | null>(() => readClaims())

  const login = async (username: string, password: string) => {
    const resp = await api.post('/auth/login', { username, password })
    const { access_token, refresh_token } = resp.data
    setTokens(access_token, refresh_token)
    setClaims(readClaims())
  }

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

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
