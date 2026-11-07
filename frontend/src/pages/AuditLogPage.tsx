import { useEffect, useState } from 'react'
import { Inbox } from 'lucide-react'
import { toast } from 'sonner'
import { PaginationBar } from '@/components/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import type { AuditLog, Page } from '@/types'

// Trang xem nhật ký thay đổi của sách và phiếu mượn (chỉ admin). Dữ liệu do trigger DB
// ghi, trang này chỉ đọc. Bấm vào một dòng để xem dữ liệu trước / sau khi sửa.
const DEFAULT_PAGE_SIZE = 20

const OPERATION_VARIANT = {
  INSERT: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
} as const

// Nhãn hiển thị trong hai ô lọc (giá trị 'all' = không lọc).
const TABLE_LABELS: Record<string, string> = { all: 'All tables', books: 'Books', loans: 'Loans' }
const OPERATION_LABELS: Record<string, string> = {
  all: 'All actions',
  INSERT: 'Insert',
  UPDATE: 'Update',
  DELETE: 'Delete',
}

// Định dạng thời điểm thay đổi hiển thị trong bảng.
function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US')
}

// Hiển thị một giá trị JSON gọn trong ô bảng (chuỗi dài bị cắt bớt).
function formatValue(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

// So sánh old_data và new_data, trả về danh sách trường thay đổi (bỏ search_vector là
// cột sinh tự động, chỉ gây nhiễu). INSERT / DELETE không có bên còn lại nên trả rỗng.
function changedFields(log: AuditLog) {
  if (!log.old_data || !log.new_data) return []
  const keys = new Set([...Object.keys(log.old_data), ...Object.keys(log.new_data)])
  return [...keys]
    .filter((k) => k !== 'search_vector')
    .filter((k) => JSON.stringify(log.old_data![k]) !== JSON.stringify(log.new_data![k]))
    .map((k) => ({ field: k, from: log.old_data![k], to: log.new_data![k] }))
}

// Tóm tắt một dòng log cho cột "Changes": UPDATE liệt kê trường đổi, INSERT / DELETE
// nói rõ là tạo mới / xóa.
function ChangeSummary({ log }: { log: AuditLog }) {
  if (log.operation === 'INSERT') return <span className="text-muted-foreground">Row created</span>
  if (log.operation === 'DELETE') return <span className="text-muted-foreground">Row deleted</span>
  const changes = changedFields(log)
  if (changes.length === 0) return <span className="text-muted-foreground">No visible change</span>
  return (
    <div className="space-y-0.5">
      {changes.slice(0, 3).map((c) => (
        <div key={c.field} className="text-xs">
          <span className="font-medium">{c.field}</span>:{' '}
          <span className="text-muted-foreground line-through">{formatValue(c.from)}</span> →{' '}
          {formatValue(c.to)}
        </div>
      ))}
      {changes.length > 3 && (
        <div className="text-xs text-muted-foreground">+{changes.length - 3} more</div>
      )}
    </div>
  )
}

// Khung hiển thị JSON của dòng trước / sau khi sửa trong hộp thoại chi tiết.
function JsonBlock({ title, data }: { title: string; data: Record<string, unknown> | null }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
        {data ? JSON.stringify(data, null, 2) : '—'}
      </pre>
    </div>
  )
}

export function AuditLogPage() {
  const [tableName, setTableName] = useState('all')
  const [operation, setOperation] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, page_size: DEFAULT_PAGE_SIZE, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AuditLog | null>(null)

  // Tải một trang audit log theo bộ lọc bảng / thao tác và phân trang hiện tại.
  const load = async () => {
    setLoading(true)
    try {
      const resp = await api.get('/audit-logs', {
        params: {
          table_name: tableName === 'all' ? undefined : tableName,
          operation: operation === 'all' ? undefined : operation,
          page,
          page_size: pageSize,
        },
      })
      const body = resp.data as Page<AuditLog>
      setLogs(body.items)
      setPageInfo(body)
    } catch {
      toast.error('Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }

  // Tải lại khi đổi bộ lọc, trang hoặc số dòng/trang.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, operation, page, pageSize])

  // Đổi bộ lọc hoặc số dòng/trang thì quay về trang 1.
  useEffect(() => {
    setPage(1)
  }, [tableName, operation, pageSize])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Who changed books and loans, and what changed
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={tableName} onValueChange={(v) => v && setTableName(v)}>
            <SelectTrigger className="w-36">
              <SelectValue>{(v: string) => TABLE_LABELS[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tables</SelectItem>
              <SelectItem value="books">Books</SelectItem>
              <SelectItem value="loans">Loans</SelectItem>
            </SelectContent>
          </Select>
          <Select value={operation} onValueChange={(v) => v && setOperation(v)}>
            <SelectTrigger className="w-36">
              <SelectValue>{(v: string) => OPERATION_LABELS[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="INSERT">Insert</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Row</TableHead>
                <TableHead>Changed by</TableHead>
                <TableHead>Changes</TableHead>
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
              {!loading && logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Inbox className="size-8" strokeWidth={1.5} />
                      No audit entries
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelected(log)}>
                  <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                    {formatDate(log.changed_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.table_name}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={OPERATION_VARIANT[log.operation]}>{log.operation}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">#{log.row_id}</TableCell>
                  <TableCell className="text-sm">
                    {log.changed_by_username ??
                      (log.changed_by ? `user #${log.changed_by}` : (
                        <span className="text-muted-foreground">System</span>
                      ))}
                  </TableCell>
                  <TableCell>
                    <ChangeSummary log={log} />
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

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.operation} {selected?.table_name} #{selected?.row_id}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {formatDate(selected.changed_at)} by{' '}
                {selected.changed_by_username ?? (selected.changed_by ? `user #${selected.changed_by}` : 'System')}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <JsonBlock title="Before" data={selected.old_data} />
                <JsonBlock title="After" data={selected.new_data} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
