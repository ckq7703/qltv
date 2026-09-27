import { useEffect, useState } from 'react'
import { Gauge, RefreshCw, Target, TrendingUp, Users, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { PaginationBar } from '@/components/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import type { ActiveMember, CacheStats, Page, TopBook } from '@/types'

const DEFAULT_PAGE_SIZE = 10

const emptyPage = { total: 0, page: 1, page_size: DEFAULT_PAGE_SIZE, total_pages: 1 }

export function StatsPage() {
  const [topBooks, setTopBooks] = useState<TopBook[]>([])
  const [topBooksPage, setTopBooksPage] = useState(1)
  const [topBooksPageSize, setTopBooksPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [topBooksInfo, setTopBooksInfo] = useState(emptyPage)

  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([])
  const [activeMembersPage, setActiveMembersPage] = useState(1)
  const [activeMembersPageSize, setActiveMembersPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [activeMembersInfo, setActiveMembersInfo] = useState(emptyPage)

  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadTopBooks = async (page: number, pageSize: number) => {
    try {
      const resp = await api.get<Page<TopBook>>('/stats/top-books', {
        params: { page, page_size: pageSize },
      })
      setTopBooks(resp.data.items)
      setTopBooksInfo(resp.data)
    } catch {
      toast.error('Failed to load top books')
    }
  }

  const loadActiveMembers = async (page: number, pageSize: number) => {
    try {
      const resp = await api.get<Page<ActiveMember>>('/stats/active-members', {
        params: { page, page_size: pageSize },
      })
      setActiveMembers(resp.data.items)
      setActiveMembersInfo(resp.data)
    } catch {
      toast.error('Failed to load active members')
    }
  }

  const loadCacheStats = async () => {
    try {
      const resp = await api.get<CacheStats>('/stats/cache')
      setCacheStats(resp.data)
    } catch {
      toast.error('Failed to load cache stats')
    }
  }

  useEffect(() => {
    loadTopBooks(topBooksPage, topBooksPageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topBooksPage, topBooksPageSize])

  useEffect(() => {
    setTopBooksPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topBooksPageSize])

  useEffect(() => {
    loadActiveMembers(activeMembersPage, activeMembersPageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembersPage, activeMembersPageSize])

  useEffect(() => {
    setActiveMembersPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembersPageSize])

  useEffect(() => {
    loadCacheStats()
  }, [])

  const handleRefreshMonthly = async () => {
    setRefreshing(true)
    try {
      await api.post('/stats/refresh-monthly')
      toast.success('Monthly report refreshed (materialized view)')
    } catch {
      toast.error('Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Statistics</h1>
          <p className="text-sm text-muted-foreground">Live insights from the library database</p>
        </div>
        <Button variant="outline" onClick={handleRefreshMonthly} disabled={refreshing}>
          <RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} />
          Refresh monthly report
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cache hit ratio</CardTitle>
            <Gauge className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cacheStats ? `${(cacheStats.hit_ratio * 100).toFixed(1)}%` : '—'}
            </div>
            <p className="text-xs text-muted-foreground">Redis cache-aside search results</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cache hits</CardTitle>
            <Zap className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheStats?.hits ?? '—'}</div>
            <p className="text-xs text-muted-foreground">Served without hitting Postgres</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cache misses</CardTitle>
            <Target className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheStats?.misses ?? '—'}</div>
            <p className="text-xs text-muted-foreground">Queries that hit the database</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-muted-foreground" />
              Most borrowed books
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Times borrowed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topBooks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No loan history yet
                    </TableCell>
                  </TableRow>
                )}
                {topBooks.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Badge variant={b.rank === 1 ? 'default' : 'outline'} className="px-2">
                        {b.rank}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{b.title}</TableCell>
                    <TableCell className="text-right">{b.times_borrowed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(
              <PaginationBar
                page={topBooksInfo.page}
                totalPages={topBooksInfo.total_pages}
                total={topBooksInfo.total}
                onPageChange={setTopBooksPage}
                pageSize={topBooksPageSize}
                onPageSizeChange={setTopBooksPageSize}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-muted-foreground" />
              Most active members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Full name</TableHead>
                  <TableHead className="text-right">Loans</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No loan history yet
                    </TableCell>
                  </TableRow>
                )}
                {activeMembers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge variant={m.activity_rank === 1 ? 'default' : 'outline'} className="px-2">
                        {m.activity_rank}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{m.full_name}</TableCell>
                    <TableCell className="text-right">{m.total_loans}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(
              <PaginationBar
                page={activeMembersInfo.page}
                totalPages={activeMembersInfo.total_pages}
                total={activeMembersInfo.total}
                onPageChange={setActiveMembersPage}
                pageSize={activeMembersPageSize}
                onPageSizeChange={setActiveMembersPageSize}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
