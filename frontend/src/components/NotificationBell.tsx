import { useState } from 'react'
import { Bell, BookMarked, CheckCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { AdminNotification } from '@/hooks/useAdminNotifications'

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString('en-US')
}

interface NotificationBellProps {
  notifications: AdminNotification[]
  unreadCount: number
  onOpen: () => void
  onSelectLoan: (loanId: number) => void
}

export function NotificationBell({ notifications, unreadCount, onOpen, onSelectLoan }: NotificationBellProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(next) => {
        setPopoverOpen(next)
        if (next) onOpen()
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" title="Notifications">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCheck className="size-3" />
              Marked as read
            </span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications yet — you'll see it here the moment a member borrows a book.
            </p>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setPopoverOpen(false)
                onSelectLoan(n.loan_id)
              }}
              className="flex w-full gap-2.5 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/60"
            >
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BookMarked className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <span className="font-medium">{n.member_name}</span> borrowed{' '}
                  <span className="font-medium">"{n.book_title}"</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.occurred_at)}</p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
