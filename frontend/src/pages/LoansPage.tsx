import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  CheckCircle2,
  Clock,
  Inbox,
  RotateCcw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { BookCover } from '@/components/BookCover'
import { LoanDetailDialog } from '@/components/LoanDetailDialog'
import { PaginationBar } from '@/components/PaginationBar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import type { Loan, OverdueLoan, Page } from '@/types'

const DEFAULT_PAGE_SIZE = 10

type SortDir = 'asc' | 'desc'

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US')
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function MemberCell({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-7 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback className="bg-primary/10 text-[11px] text-primary">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{name}</span>
    </div>
  )
}

function BookCell({ title, coverUrl, seed }: { title: string; coverUrl: string | null; seed: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 shrink-0">
        <BookCover title={title} seed={seed} coverUrl={coverUrl} />
      </div>
      <span className="line-clamp-2 text-sm">{title}</span>
    </div>
  )
}

export function LoansPage() {
  const [status, setStatus] = useState<'borrowed' | 'overdue'>('borrowed')
  const [search, setSearch] = useState('')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const [loans, setLoans] = useState<Loan[]>([])
  const [overdue, setOverdue] = useState<OverdueLoan[]>([])
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, page_size: DEFAULT_PAGE_SIZE, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null)

  const load = async (currentStatus: 'borrowed' | 'overdue', currentPage: number, dir: SortDir) => {
    setLoading(true)
    try {
      const resp = await api.get('/loans', {
        params: {
          status: currentStatus,
          search: search || undefined,
          sort_by: 'due_date',
          sort_dir: dir,
          page: currentPage,
          page_size: pageSize,
        },
      })
      const body = resp.data as Page<Loan> | Page<OverdueLoan>
      if (currentStatus === 'overdue') {
        setOverdue(body.items as OverdueLoan[])
      } else {
        setLoans(body.items as Loan[])
      }
      setPageInfo(body)
    } catch {
      toast.error('Failed to load loans')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => load(status, page, sortDir), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, sortDir, pageSize, search])

  useEffect(() => {
    setPage(1)
  }, [status, sortDir, pageSize, search])

  const handleReturn = async (loanId: number) => {
    try {
      await api.post(`/loans/${loanId}/return`)
      toast.success('Return recorded')
      load(status, page, sortDir)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to return book')
    }
  }

  const SortControl = (
    <div className="flex items-center gap-2">
      <Select value="due_date">
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="due_date">Sort: Due date</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
        title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
      >
        {sortDir === 'asc' ? <ArrowUpAZ className="size-4" /> : <ArrowDownAZ className="size-4" />}
      </Button>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Borrow / Return</h1>
          <p className="text-sm text-muted-foreground">Track active and overdue loans</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs min-w-40 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by book or member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {SortControl}
        </div>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as 'borrowed' | 'overdue')}>
        <TabsList>
          <TabsTrigger value="borrowed" className="gap-1.5">
            <Clock className="size-3.5" />
            Active
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1.5">
            <AlertTriangle className="size-3.5" />
            Overdue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="borrowed" className="space-y-3">
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Loan</TableHead>
                    <TableHead>Book</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Borrowed at</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && loans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Inbox className="size-8" strokeWidth={1.5} />
                          No active loans
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {loans.map((loan) => (
                    <TableRow
                      key={loan.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedLoanId(loan.id)}
                    >
                      <TableCell>
                        <Badge variant="outline">#{loan.id}</Badge>
                      </TableCell>
                      <TableCell>
                        <BookCell title={loan.book_title} coverUrl={loan.book_cover_url} seed={loan.book_copy_id} />
                      </TableCell>
                      <TableCell>
                        <MemberCell name={loan.member_full_name} avatarUrl={loan.member_avatar_url} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(loan.borrowed_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(loan.due_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReturn(loan.id)
                          }}
                        >
                          <RotateCcw className="size-3.5" />
                          Return
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {!loading && (
            <PaginationBar
              page={pageInfo.page}
              totalPages={pageInfo.total_pages}
              total={pageInfo.total}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          )}
        </TabsContent>

        <TabsContent value="overdue" className="space-y-3">
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Loan</TableHead>
                    <TableHead>Book</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Overdue by</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && overdue.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="size-8 text-muted-foreground" strokeWidth={1.5} />
                          No overdue loans
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {overdue.map((loan) => (
                    <TableRow
                      key={loan.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedLoanId(loan.id)}
                    >
                      <TableCell>
                        <Badge variant="outline">#{loan.id}</Badge>
                      </TableCell>
                      <TableCell>
                        <BookCell title={loan.book_title} coverUrl={loan.book_cover_url} seed={loan.book_copy_id} />
                      </TableCell>
                      <TableCell>
                        <MemberCell name={loan.member_full_name} avatarUrl={loan.member_avatar_url} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(loan.due_date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="size-3" />
                          {loan.overdue_by}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReturn(loan.id)
                          }}
                        >
                          <RotateCcw className="size-3.5" />
                          Return
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {!loading && (
            <PaginationBar
              page={pageInfo.page}
              totalPages={pageInfo.total_pages}
              total={pageInfo.total}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          )}
        </TabsContent>
      </Tabs>

      <LoanDetailDialog
        loanId={selectedLoanId}
        onOpenChange={(open) => !open && setSelectedLoanId(null)}
        onChanged={() => load(status, page, sortDir)}
      />
    </div>
  )
}
