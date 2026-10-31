import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

// Axios client dùng chung + quản lý JWT trong localStorage.
// Tự gắn Bearer token vào mỗi request và tự refresh khi gặp 401 (xem interceptor bên dưới).
const ACCESS_TOKEN_KEY = 'qltv_access_token'
const REFRESH_TOKEN_KEY = 'qltv_refresh_token'

// Đọc / ghi / xóa cặp token trong localStorage.
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// Các trường frontend cần đọc trong payload của access token.
export interface JwtClaims {
  sub: string
  role: 'admin' | 'member'
  member_id: number | null
  exp: number
}

// Giải mã phần payload của JWT (base64url) để lấy role, member_id, exp.
// Chỉ ĐỌC để hiển thị UI, không kiểm tra chữ ký — việc xác thực thật do backend làm.
export function decodeAccessToken(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

// Mọi request đi qua tiền tố /api (Vite dev server proxy sang backend, xem vite.config.ts).
export const api = axios.create({ baseURL: '/api' })

// Trước mỗi request: gắn header Authorization nếu đã có token.
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Giữ 1 lần refresh đang chạy để nhiều request cùng bị 401 chỉ gọi refresh đúng 1 lần.
let refreshPromise: Promise<string | null> | null = null

// Đổi refresh token lấy cặp token mới. Thất bại thì xóa token và trả null.
// Dùng axios gốc (không phải `api`) để tránh interceptor gọi lặp vô hạn.
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  try {
    const resp = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
    const { access_token, refresh_token } = resp.data
    setTokens(access_token, refresh_token)
    return access_token
  } catch {
    clearTokens()
    return null
  }
}

// Sau mỗi response: nếu bị 401 thì refresh token rồi thử lại request đúng 1 lần (_retry);
// refresh không được thì chuyển về trang đăng nhập.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      const newToken = await refreshPromise
      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      }
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
