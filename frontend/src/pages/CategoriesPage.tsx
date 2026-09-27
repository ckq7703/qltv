import { useEffect, useState } from 'react'
import { FolderTree, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import type { Category } from '@/types'

interface FormState {
  name: string
  parentId: string
}

const emptyForm: FormState = { name: '', parentId: 'none' }

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const load = async () => {
    setLoading(true)
    try {
      const resp = await api.get<Category[]>('/categories')
      setCategories(resp.data)
    } catch {
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const parentName = (parentId: number | null) => {
    if (parentId === null) return null
    return categories.find((c) => c.id === parentId)?.name ?? `#${parentId}`
  }

  const openCreateDialog = () => {
    setMode('create')
    setEditingId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEditDialog = (category: Category) => {
    setMode('edit')
    setEditingId(category.id)
    setForm({
      name: category.name,
      parentId: category.parent_id ? String(category.parent_id) : 'none',
    })
    setOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Category name is required')
      return
    }
    const payload = {
      name: form.name.trim(),
      parent_id: form.parentId === 'none' ? null : Number(form.parentId),
    }
    try {
      if (mode === 'create') {
        await api.post('/categories', payload)
        toast.success('Category added')
      } else if (editingId) {
        await api.put(`/categories/${editingId}`, payload)
        toast.success('Category updated')
      }
      setOpen(false)
      load()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to save category')
    }
  }

  const handleDelete = async (category: Category) => {
    if (!confirm(`Delete category "${category.name}"?`)) return
    try {
      await api.delete(`/categories/${category.id}`)
      toast.success('Category deleted')
      load()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to delete category')
    }
  }

  // Options for the parent select must exclude the category being edited (can't be its own parent).
  const parentOptions = categories.filter((c) => c.id !== editingId)

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground">Organize books by category and subcategory</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button onClick={openCreateDialog}>
                <Plus className="size-4" />
                Add category
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{mode === 'create' ? 'Add new category' : 'Edit category'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Parent category</Label>
                <Select
                  value={form.parentId}
                  onValueChange={(v) => setForm((f) => ({ ...f, parentId: v ?? 'none' }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No parent (top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent (top-level)</SelectItem>
                    {parentOptions.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {!loading && categories.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <FolderTree className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No categories yet</p>
        </div>
      )}

      {!loading && categories.length > 0 && filteredCategories.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Search className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No categories match "{search}"</p>
        </div>
      )}

      {!loading && filteredCategories.length > 0 && (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Parent category</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <Tags className="size-3.5 text-muted-foreground" />
                        {category.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      {parentName(category.parent_id) ? (
                        <Badge variant="outline">{parentName(category.parent_id)}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Top-level</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="icon-sm"
                          variant="outline"
                          onClick={() => openEditDialog(category)}
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          onClick={() => handleDelete(category)}
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
