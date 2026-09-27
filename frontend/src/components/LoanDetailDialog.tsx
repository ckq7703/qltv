import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  Loader2,
  Mail,
  RotateCcw,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { BookCover } from '@/components/BookCover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import type { LoanDetail, LoanStatus } from '@/types'

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: LoanStatus }) {
  if (status === 'returned') {
    return (
      <Badge variant="secondary" className="gap-1">
        <BadgeCheck className="size-3" />
        Returned
      </Badge>
    )
  }
  if (status === 'overdue') {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" />
        Overdue
      </Badge>
    )
  }
  return (
    <Badge className="gap-1 bg-emerald-600/90 text-white">
      <BadgeCheck className="size-3" />
      Active
    </Badge>
  )
}

interface LoanDetailDialogProps {
  loanId: number | null
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}

export function LoanDetailDialog({ loanId, onOpenChange, onChanged }: LoanDetailDialogProps) {
  const open = loanId !== null
  const [loan, setLoan] = useState<LoanDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [returning, setReturning] = useState(false)

  useEffect(() => {
    if (loanId === null) {
      setLoan(null)
      return
    }
    setLoading(true)
    api
      .get<LoanDetail>(`/loans/${loanId}`)
      .then((resp) => setLoan(resp.data))
      .catch(() => {
        toast.error('Failed to load loan details')
        onOpenChange(false)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId])

  const handleReturn = async () => {
    if (!loan) return
    setReturning(true)
    try {
      await api.post(`/loans/${loan.id}/return`)
      toast.success('Return recorded')
      onChanged?.()
      onOpenChange(false)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to return book')
    } finally {
      setReturning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Loan details</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && loan && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Loan #{loan.id}</Badge>
              <StatusBadge status={loan.status} />
            </div>

            <div className="flex gap-3 rounded-lg border p-3">
              <div className="w-14 shrink-0">
                <BookCover title={loan.book.title} seed={loan.book.id} coverUrl={loan.book.cover_url} />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium">{loan.book.title}</p>
                <p className="text-xs text-muted-foreground">
                  {loan.book.authors.join(', ') || 'Unknown author'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Avatar className="size-9 shrink-0">
                {loan.member.avatar_url && (
                  <AvatarImage src={loan.member.avatar_url} alt={loan.member.full_name} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary">
                  <UserRound className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{loan.member.full_name}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <Mail className="size-3 shrink-0" />
                  {loan.member.email}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  Borrowed at
                </p>
                <p className="mt-1 text-sm font-medium">{formatDate(loan.borrowed_at)}</p>
              </div>
              <div
                className={`rounded-lg border p-3 ${loan.status === 'overdue' ? 'border-destructive/30 bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}
              >
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  {loan.status === 'returned' ? 'Was due' : 'Due date'}
                </p>
                <p
                  className={`mt-1 text-sm font-medium ${loan.status === 'overdue' ? 'text-destructive' : 'text-primary'}`}
                >
                  {formatDate(loan.due_date)}
                </p>
              </div>
            </div>

            {loan.returned_at && (
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BadgeCheck className="size-3.5" />
                  Returned at
                </p>
                <p className="mt-1 text-sm font-medium">{formatDate(loan.returned_at)}</p>
              </div>
            )}
          </div>
        )}

        {!loading && loan && loan.status !== 'returned' && (
          <DialogFooter>
            <Button onClick={handleReturn} disabled={returning}>
              {returning ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              {returning ? 'Returning...' : 'Mark as returned'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
