import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getAccessToken } from '@/lib/api'
import type { BookBorrowedNotification } from '@/types'

// Mất kết nối WebSocket thì thử nối lại sau 3 giây.
const RECONNECT_DELAY_MS = 3000

// Thông báo hiển thị trong chuông: thêm id và cờ đã đọc vào dữ liệu server gửi.
export interface AdminNotification extends BookBorrowedNotification {
  id: string
  read: boolean
}

// Hook nhận thông báo realtime cho admin qua WebSocket /ws/notifications (backend đẩy từ Redis pub/sub).
// `enabled` = true chỉ khi người dùng là admin. Trả về danh sách (tối đa 20 mới nhất),
// số chưa đọc và hàm đánh dấu đã đọc. Tự kết nối lại khi mất kết nối.
export function useAdminNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Dùng ref để callback onclose luôn thấy giá trị `enabled` mới nhất.
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    // Mở kết nối WebSocket. Trình duyệt không gửi được header nên token truyền qua query string.
    const connect = () => {
      if (cancelled) return
      const token = getAccessToken()
      if (!token) return

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/notifications?token=${token}`)
      socketRef.current = ws

      // Có thông báo mới: thêm vào đầu danh sách và hiện toast.
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as BookBorrowedNotification
          const notification: AdminNotification = {
            ...payload,
            id: `${payload.loan_id}-${payload.occurred_at}`,
            read: false,
          }
          setNotifications((prev) => [notification, ...prev].slice(0, 20))
          toast.info(`${payload.member_name} borrowed "${payload.book_title}"`, {
            description: `Due ${new Date(payload.due_date).toLocaleDateString('en-US')}`,
          })
        } catch {
          // ignore malformed message
        }
      }

      // Bị đóng: hẹn nối lại, trừ khi hook đã bị hủy hoặc không còn là admin.
      ws.onclose = () => {
        socketRef.current = null
        if (!cancelled && enabledRef.current) {
          reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

    // Dọn dẹp khi unmount hoặc `enabled` đổi: hủy hẹn giờ nối lại và đóng socket.
    return () => {
      cancelled = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [enabled])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return { notifications, unreadCount, markAllRead }
}
