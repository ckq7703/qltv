import { useEffect, useRef, useState } from 'react'
import {
  BookX,
  Filter,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  PlusCircle,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { BookCover } from '@/components/BookCover'
import { BorrowWizard } from '@/components/BorrowWizard'
import { PaginationBar } from '@/components/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import type { Author, Book, BookCopy, Category, CopyStatus, Page } from '@/types'

const PAGE_SIZE = 10

type SortBy = 'created_at' | 'title' | 'available_copies'
type SortDir = 'asc' | 'desc'

interface BookFormState {
  title: string
  isbn: string
  categoryId: string
  coverUrl: string
  copiesCount: string
  authorIds: number[]
}

const emptyForm: BookFormState = {
  title: '',
  isbn: '',
  categoryId: 'none',
  coverUrl: '',
  copiesCount: '1',
  authorIds: [],
}

export function BooksPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const isMember = role === 'member'

  const [books, setBooks] = useState<Book[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState<Omit<Page<Book>, 'items'>>({
    total: 0,
    page: 1,
    page_size: PAGE_SIZE,
    total_pages: 1,
  })

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingBookId, setEditingBookId] = useState<number | null>(null)
  const [form, setForm] = useState<BookFormState>(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [addCopiesValue, setAddCopiesValue] = useState('1')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [copies, setCopies] = useState<BookCopy[]>([])
  const [copiesLoading, setCopiesLoading] = useState(false)

  const [borrowBook, setBorrowBook] = useState<Book | null>(null)

  useEffect(() => {
    api
      .get<Category[]>('/categories')
      .then((resp) => setCategories(resp.data))
      .catch(() => undefined)
    api
      .get<Author[]>('/authors')
      .then((resp) => setAuthors(resp.data))
      .catch(() => undefined)
  }, [])

  const loadCopies = async (bookId: number) => {
    setCopiesLoading(true)
    try {
      const resp = await api.get<BookCopy[]>(`/books/${bookId}/copies`)
      setCopies(resp.data)
    } catch {
      toast.error('Failed to load copies')
    } finally {
      setCopiesLoading(false)
    }
  }

  const handleSetCopyStatus = async (copyId: number, status: CopyStatus) => {
    if (!editingBookId) return
    try {
      await api.patch(`/books/${editingBookId}/copies/${copyId}`, { status })
      toast.success('Copy status updated')
      loadCopies(editingBookId)
      loadBooks()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to update copy status')
    }
  }

  const loadBooks = async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | boolean> = {
        page,
        page_size: PAGE_SIZE,
        sort_by: sortBy,
        sort_dir: sortDir,
      }
      if (search) params.search = search
      if (categoryFilter !== 'all') params.category_id = categoryFilter
      if (availableOnly) params.available_only = true

      const resp = await api.get<Page<Book>>('/books', { params })
      setBooks(resp.data.items)
      setPageInfo(resp.data)
    } catch {
      toast.error('Failed to load books')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadBooks, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, availableOnly, sortBy, sortDir, page])

  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter, availableOnly, sortBy, sortDir])

  const activeFilterCount = (categoryFilter !== 'all' ? 1 : 0) + (availableOnly ? 1 : 0)

  const openCreateDialog = () => {
    setFormMode('create')
    setEditingBookId(null)
    setForm(emptyForm)
    setCopies([])
    setFormOpen(true)
  }

  const openEditDialog = (book: Book) => {
    setFormMode('edit')
    setEditingBookId(book.id)
    setForm({
      title: book.title,
      isbn: book.isbn,
      categoryId: book.category_id ? String(book.category_id) : 'none',
      coverUrl: book.cover_url ?? '',
      copiesCount: '1',
      authorIds: book.authors.map((a) => a.id),
    })
    setAddCopiesValue('1')
    loadCopies(book.id)
    setFormOpen(true)
  }

  const toggleAuthor = (authorId: number) => {
    setForm((f) => ({
      ...f,
      authorIds: f.authorIds.includes(authorId)
        ? f.authorIds.filter((id) => id !== authorId)
        : [...f.authorIds, authorId],
    }))
  }

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const data = new FormData()
      data.append('file', file)
      const resp = await api.post<{ url: string }>('/uploads/cover', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setForm((f) => ({ ...f, coverUrl: resp.data.url }))
      toast.success('Cover uploaded')
    } catch {
      toast.error('Failed to upload cover image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmitForm = async () => {
    if (!form.title || !form.isbn) {
      toast.error('Title and ISBN are required')
      return
    }
    try {
      if (formMode === 'create') {
        await api.post('/books', {
          title: form.title,
          isbn: form.isbn,
          category_id: form.categoryId === 'none' ? null : Number(form.categoryId),
          cover_url: form.coverUrl || null,
          copies_count: Number(form.copiesCount) || 1,
          author_ids: form.authorIds,
        })
        toast.success('Book added')
      } else if (editingBookId) {
        await api.put(`/books/${editingBookId}`, {
          title: form.title,
          isbn: form.isbn,
          category_id: form.categoryId === 'none' ? null : Number(form.categoryId),
          cover_url: form.coverUrl || null,
          author_ids: form.authorIds,
        })
        const extra = Number(addCopiesValue)
        if (extra > 0) {
          await api.post(`/books/${editingBookId}/copies`, { count: extra })
        }
        toast.success('Book updated')
      }
      setFormOpen(false)
      loadBooks()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to save book')
    }
  }

  const handleDeleteBook = async (book: Book) => {
    if (!confirm(`Delete book "${book.title}"?`)) return
    try {
      await api.delete(`/books/${book.id}`)
      toast.success('Book deleted')
      loadBooks()
    } catch {
      toast.error('Failed to delete book')
    }
  }

  const openBorrowWizard = (book: Book) => setBorrowBook(book)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1 min-w-40">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" className="gap-1.5">
                  <Filter className="size-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="ml-1 h-5 min-w-5 px-1">{activeFilterCount}</Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-72 space-y-4" align="start">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? 'all')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="available-only"
                  checked={availableOnly}
                  onCheckedChange={(v) => setAvailableOnly(v === true)}
                />
                <Label htmlFor="available-only" className="font-normal">
                  Available to borrow only
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Sort by</Label>
                <div className="flex gap-2">
                  <Select value={sortBy} onValueChange={(v) => setSortBy((v ?? 'created_at') as SortBy)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Date added</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="available_copies">Availability</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortDir} onValueChange={(v) => setSortDir((v ?? 'desc') as SortDir)}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Desc</SelectItem>
                      <SelectItem value="asc">Asc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setCategoryFilter('all')
                    setAvailableOnly(false)
                  }}
                >
                  <X className="size-3.5" />
                  Clear filters
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {isAdmin && (
          <Button onClick={openCreateDialog}>
            <Plus className="size-4" />
            Add book
          </Button>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[210/297] w-full rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!loading && books.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <BookX className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No matching books found</p>
        </div>
      )}

      {!loading && books.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {books.map((book) => {
            const inStock = book.available_copies > 0
            return (
              <div
                key={book.id}
                className="group overflow-hidden rounded-xl bg-card shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg dark:shadow-black/20 dark:hover:shadow-black/40"
              >
                <div className="relative">
                  <div className="transition-transform duration-500 ease-out group-hover:scale-105">
                    <BookCover title={book.title} seed={book.id} coverUrl={book.cover_url} />
                  </div>

                  {/* Availability — ribbon-shaped tag over the cover */}
                  <div
                    className="absolute top-4 right-0 flex items-center gap-1.5 bg-gradient-to-l from-black/90 via-black/75 to-black/40 py-1.5 pr-3 pl-5 text-[11px] font-medium text-white shadow"
                    style={{ clipPath: 'polygon(14px 0, 100% 0, 100% 100%, 14px 100%, 0 50%)' }}
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${inStock ? 'bg-emerald-300' : 'bg-zinc-300'}`}
                    />
                    {book.available_copies}/{book.total_copies}
                  </div>

                  {/* Admin quick actions — revealed on hover, like a media-library card */}
                  {isAdmin && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-1 items-center justify-center gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pt-10 pb-2.5 opacity-0 transition-all duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
                      <Button
                        size="icon"
                        className="size-8 rounded-full bg-white text-foreground shadow hover:bg-white/90 disabled:opacity-40"
                        disabled={!inStock}
                        onClick={() => openBorrowWizard(book)}
                        title="Borrow"
                      >
                        <UserRound className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        className="size-8 rounded-full bg-white/90 text-foreground shadow hover:bg-white"
                        onClick={() => openEditDialog(book)}
                        title="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        className="size-8 rounded-full bg-white/90 text-destructive shadow hover:bg-white"
                        onClick={() => handleDeleteBook(book)}
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Member self-service — a single "Borrow for me" action on hover */}
                  {isMember && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-1 items-center justify-center gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pt-10 pb-2.5 opacity-0 transition-all duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
                      <Button
                        size="sm"
                        className="rounded-full bg-white px-3 text-foreground shadow hover:bg-white/90 disabled:opacity-40"
                        disabled={!inStock}
                        onClick={() => openBorrowWizard(book)}
                      >
                        <UserRound className="size-3.5" />
                        Borrow
                      </Button>
                    </div>
                  )}
                </div>

                <div className="px-2.5 pt-2.5 pb-3">
                  <h3 className="line-clamp-2 text-sm leading-snug font-medium transition-colors group-hover:text-primary">
                    {book.title}
                  </h3>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {book.authors.map((a) => a.full_name).join(', ') || 'Unknown author'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && (
        <PaginationBar
          page={pageInfo.page}
          totalPages={pageInfo.total_pages}
          total={pageInfo.total}
          onPageChange={setPage}
        />
      )}

      {/* Create / edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Add new book' : 'Edit book'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            <div className="flex gap-4">
              <div className="w-24 shrink-0">
                {form.coverUrl ? (
                  <BookCover title={form.title || '?'} seed={editingBookId ?? 0} coverUrl={form.coverUrl} />
                ) : (
                  <BookCover title={form.title || '?'} seed={editingBookId ?? 0} />
                )}
              </div>
              <div className="flex flex-1 flex-col justify-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleUploadCover}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="size-3.5" />
                  )}
                  {uploading ? 'Uploading...' : 'Upload cover'}
                </Button>
                {form.coverUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, coverUrl: '' }))}
                  >
                    <X className="size-3.5" />
                    Remove cover
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="book-title">Title</Label>
              <Input
                id="book-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-isbn">ISBN</Label>
              <Input
                id="book-isbn"
                value={form.isbn}
                onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v ?? 'none' }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Authors</Label>
              {authors.length === 0 ? (
                <p className="text-xs text-muted-foreground">No authors yet</p>
              ) : (
                <div className="grid max-h-32 grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto rounded-md border p-2.5">
                  {authors.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.authorIds.includes(a.id)}
                        onCheckedChange={() => toggleAuthor(a.id)}
                      />
                      <span className="truncate">{a.full_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {formMode === 'create' ? (
              <div className="space-y-2">
                <Label htmlFor="book-copies">Number of copies</Label>
                <Input
                  id="book-copies"
                  type="number"
                  min={0}
                  value={form.copiesCount}
                  onChange={(e) => setForm((f) => ({ ...f, copiesCount: e.target.value }))}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="book-add-copies">Add more copies</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="book-add-copies"
                      type="number"
                      min={0}
                      value={addCopiesValue}
                      onChange={(e) => setAddCopiesValue(e.target.value)}
                      className="w-24"
                    />
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <PlusCircle className="size-3.5" />
                      New copies are added as available
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Manage copies</Label>
                  {copiesLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
                  {!copiesLoading && copies.length === 0 && (
                    <p className="text-xs text-muted-foreground">No copies yet</p>
                  )}
                  {!copiesLoading && copies.length > 0 && (
                    <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-2.5">
                      {copies.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{c.id}</span>
                            <Badge
                              variant={
                                c.status === 'available'
                                  ? 'default'
                                  : c.status === 'borrowed'
                                    ? 'secondary'
                                    : 'destructive'
                              }
                              className="text-[10px]"
                            >
                              {c.status}
                            </Badge>
                          </div>
                          {c.status === 'borrowed' ? (
                            <span className="text-xs text-muted-foreground">On loan</span>
                          ) : c.status === 'available' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleSetCopyStatus(c.id, 'damaged')}
                            >
                              Mark damaged/lost
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleSetCopyStatus(c.id, 'available')}
                            >
                              Restore
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Marking a copy lost/damaged removes it from the available count while
                    preserving its loan history — it is never deleted.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSubmitForm}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BorrowWizard
        book={borrowBook}
        mode={isAdmin ? 'admin' : 'member'}
        onOpenChange={(open) => !open && setBorrowBook(null)}
        onSuccess={loadBooks}
      />
    </div>
  )
}
