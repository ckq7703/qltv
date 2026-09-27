import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getAccessToken } from '@/lib/api'
import type { BookBorrowedNotification } from '@/types'

const RECONNECT_DELAY_MS = 3000

export interface AdminNotification extends BookBorrowedNotification {
  id: string
  read: boolean
}

export function useAdminNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const connect = () => {
      if (cancelled) return
      const token = getAccessToken()
      if (!token) return

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/notifications?token=${token}`)
      socketRef.current = ws

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

      ws.onclose = () => {
        socketRef.current = null
        if (!cancelled && enabledRef.current) {
          reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

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
