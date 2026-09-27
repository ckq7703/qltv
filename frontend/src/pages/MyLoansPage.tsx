import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, Inbox, RotateCcw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { BookCover } from '@/components/BookCover'
import { LoanDetailDialog } from '@/components/LoanDetailDialog'
import { PaginationBar } from '@/components/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import type { Loan, OverdueLoan, Page } from '@/types'

const DEFAULT_PAGE_SIZE = 10

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US')
}

function BookCell({ title, coverUrl, seed }: { title: string; coverUrl: string | null; seed: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 shrink-0">
        <BookCover title={title} seed={seed} coverUrl={coverUrl} />
      </div>
      <span className="line-clamp-2 text-sm font-medium">{title}</span>
    </div>
  )
}

export function MyLoansPage() {
  const [status, setStatus] = useState<'borrowed' | 'overdue'>('borrowed')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loans, setLoans] = useState<Loan[]>([])
  const [overdue, setOverdue] = useState<OverdueLoan[]>([])
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, page_size: DEFAULT_PAGE_SIZE, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [notLinked, setNotLinked] = useState(false)
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null)

  const load = async (currentStatus: 'borrowed' | 'overdue', currentPage: number) => {
    setLoading(true)
    try {
      const resp = await api.get('/loans', {
        params: { status: currentStatus, sort_by: 'due_date', page: currentPage, page_size: pageSize },
      })
      const body = resp.data as Page<Loan> | Page<OverdueLoan>
      if (currentStatus === 'overdue') {
        setOverdue(body.items as OverdueLoan[])
      } else {
        setLoans(body.items as Loan[])
      }
      setPageInfo(body)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        setNotLinked(true)
      } else {
        toast.error('Failed to load your loans')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(status, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [status, pageSize])

  const handleReturn = async (loanId: number) => {
    try {
      await api.post(`/loans/${loanId}/return`)
      toast.success('Return recorded — thanks!')
      load(status, page)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to return book')
    }
  }

  if (notLinked) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <ShieldAlert className="size-10 text-muted-foreground" strokeWidth={1.5} />
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account isn't linked to a member profile yet. Ask a librarian to link it before you
          can borrow books.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">My Loans</h1>
        <p className="text-sm text-muted-foreground">Books you currently have and their due dates</p>
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
                    <TableHead>Borrowed at</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && loans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Inbox className="size-8" strokeWidth={1.5} />
                          You have no active loans
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
                    <TableHead>Due date</TableHead>
                    <TableHead>Overdue by</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && overdue.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Inbox className="size-8" strokeWidth={1.5} />
                          Nothing overdue — you're all caught up
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
        onChanged={() => load(status, page)}
      />
    </div>
  )
}
