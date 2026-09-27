import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PaginationBarProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  pageSize?: number
  pageSizeOptions?: number[]
  onPageSizeChange?: (size: number) => void
}

export function PaginationBar({
  page,
  totalPages,
  total,
  onPageChange,
  pageSize,
  pageSizeOptions = [10, 20, 50],
  onPageSizeChange,
}: PaginationBarProps) {
  if (totalPages <= 1 && !onPageSizeChange) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{total} total</p>
      <div className="flex items-center gap-4">
        {onPageSizeChange && pageSize && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                if (v) onPageSizeChange(Number(v))
              }}
            >
              <SelectTrigger className="h-8 w-[68px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            title="First page"
          >
            <ChevronFirst className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            title="Previous page"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            title="Next page"
          >
            <ChevronRight className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            title="Last page"
          >
            <ChevronLast className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
