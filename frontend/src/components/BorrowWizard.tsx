import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ScrollText,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { BookCover } from '@/components/BookCover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import type { Book, Loan, LoanPolicy, Member, Page } from '@/types'

type Step = 'borrower' | 'review' | 'done'

const STEPS: { key: Step; label: string }[] = [
  { key: 'borrower', label: 'Borrower' },
  { key: 'review', label: 'Review & Terms' },
  { key: 'done', label: 'Confirmation' },
]

interface BorrowWizardProps {
  book: Book | null
  mode: 'admin' | 'member'
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function BorrowWizard({ book, mode, onOpenChange, onSuccess }: BorrowWizardProps) {
  const open = book !== null
  const [step, setStep] = useState<Step>('borrower')
  const [policy, setPolicy] = useState<LoanPolicy | null>(null)

  const [members, setMembers] = useState<Member[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [ownActiveLoans, setOwnActiveLoans] = useState<number | null>(null)

  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loan, setLoan] = useState<Loan | null>(null)

  useEffect(() => {
    if (!open) return
    setStep('borrower')
    setAgreed(false)
    setLoan(null)
    setSelectedMemberId('')

    api
      .get<LoanPolicy>('/loans/policy')
      .then((resp) => setPolicy(resp.data))
      .catch(() => undefined)

    if (mode === 'admin') {
      api
        .get<Page<Member>>('/members', { params: { page_size: 100 } })
        .then((resp) => setMembers(resp.data.items))
        .catch(() => toast.error('Failed to load members'))
    } else {
      api
        .get<Page<Loan>>('/loans', { params: { status: 'borrowed', page_size: 1 } })
        .then((resp) => setOwnActiveLoans(resp.data.total))
        .catch(() => setOwnActiveLoans(null))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  if (!book) return null

  const selectedMember = members.find((m) => String(m.id) === selectedMemberId)
  const canGoToReview = mode === 'admin' ? Boolean(selectedMemberId) : true
  const dueDate = policy
    ? new Date(Date.now() + policy.loan_period_days * 24 * 60 * 60 * 1000)
    : null

  const handleClose = () => {
    onOpenChange(false)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const resp = await api.post<Loan>('/loans/borrow', {
        book_id: book.id,
        member_id: mode === 'admin' ? Number(selectedMemberId) : undefined,
      })
      setLoan(resp.data)
      setStep('done')
      onSuccess()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to borrow book')
    } finally {
      setSubmitting(false)
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Borrow a book</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center gap-1.5">
              <div
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition-colors',
                  i < stepIndex && 'bg-primary text-primary-foreground',
                  i === stepIndex && 'bg-primary text-primary-foreground',
                  i > stepIndex && 'bg-muted text-muted-foreground',
                )}
              >
                {i < stepIndex ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  'hidden text-xs sm:inline',
                  i === stepIndex ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Borrower */}
        {step === 'borrower' && (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-lg border p-3">
              <div className="w-14 shrink-0">
                <BookCover title={book.title} seed={book.id} coverUrl={book.cover_url} />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium">{book.title}</p>
                <p className="text-xs text-muted-foreground">
                  {book.authors.map((a) => a.full_name).join(', ') || 'Unknown author'}
                </p>
              </div>
            </div>

            {mode === 'admin' ? (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <UserRound className="size-3.5" />
                  Select a member
                </Label>
                <Select value={selectedMemberId} onValueChange={(v) => setSelectedMemberId(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose who is borrowing" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.full_name} ({m.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="flex items-center gap-1.5 text-sm">
                  <UserRound className="size-3.5 text-muted-foreground" />
                  Borrowing for yourself
                </span>
                {ownActiveLoans !== null && policy && (
                  <Badge variant={ownActiveLoans >= policy.max_active_loans_per_member ? 'destructive' : 'outline'}>
                    {ownActiveLoans}/{policy.max_active_loans_per_member} active loans
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review & Terms */}
        {step === 'review' && policy && dueDate && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" />
                  Borrow date
                </p>
                <p className="mt-1 text-sm font-medium">{formatDate(new Date())}</p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  Due date
                </p>
                <p className="mt-1 text-sm font-medium text-primary">{formatDate(dueDate)}</p>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <ScrollText className="size-3.5" />
                Library policy
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>• Loan period: {policy.loan_period_days} days from today</li>
                <li>• Maximum {policy.max_active_loans_per_member} books borrowed at once</li>
                <li className="flex items-center gap-1">
                  <AlertTriangle className="size-3 shrink-0" />
                  Late fee: {policy.late_fee_per_day.toLocaleString('en-US')} {policy.currency} per
                  day overdue
                </li>
              </ul>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="agree-terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="agree-terms" className="text-xs leading-snug font-normal">
                I have read and agree to return this book by the due date, and understand the late
                fee policy above.
              </Label>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 'done' && loan && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-medium">Loan confirmed</p>
              <p className="text-xs text-muted-foreground">
                {mode === 'admin' && selectedMember
                  ? `Checked out to ${selectedMember.full_name}`
                  : 'Enjoy your book!'}
              </p>
            </div>
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Loan ID</span>
                <Badge variant="outline">#{loan.id}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className="gap-1 bg-emerald-600/90 text-white">
                  <BadgeCheck className="size-3" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Due date</span>
                <span className="font-medium">{formatDate(loan.due_date)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer navigation */}
        <div className="flex items-center justify-between pt-1">
          {step === 'borrower' && (
            <>
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button disabled={!canGoToReview} onClick={() => setStep('review')}>
                Next
                <ChevronRight className="size-4" />
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="ghost" onClick={() => setStep('borrower')}>
                <ChevronLeft className="size-4" />
                Back
              </Button>
              <Button disabled={!agreed || submitting} onClick={handleSubmit}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? 'Borrowing...' : 'Confirm borrow'}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
