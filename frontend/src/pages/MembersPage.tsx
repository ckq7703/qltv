import { useEffect, useState } from 'react'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  Check,
  Copy,
  KeyRound,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PaginationBar } from '@/components/PaginationBar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import { api } from '@/lib/api'
import type { Member, Page } from '@/types'

const DEFAULT_PAGE_SIZE = 9

type SortBy = 'full_name' | 'joined_at'
type SortDir = 'asc' | 'desc'

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function slugifyUsername(email: string) {
  return email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('full_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pageInfo, setPageInfo] = useState<Omit<Page<Member>, 'items'>>({
    total: 0,
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total_pages: 1,
  })

  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState(generatePassword)
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<{
    username: string
    password: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const resp = await api.get<Page<Member>>('/members', {
        params: {
          search: search || undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
          page,
          page_size: pageSize,
        },
      })
      setMembers(resp.data.items)
      setPageInfo(resp.data)
    } catch {
      toast.error('Failed to load members')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sortBy, sortDir, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [search, sortBy, sortDir, pageSize])

  const resetForm = () => {
    setFullName('')
    setEmail('')
    setPhone('')
    setUsername('')
    setPassword(generatePassword())
    setUsernameTouched(false)
    setCreatedCredentials(null)
    setCopied(false)
  }

  const handleEmailChange = (value: string) => {
    setEmail(value)
    if (!usernameTouched) setUsername(slugifyUsername(value))
  }

  const handleCreate = async () => {
    if (!fullName || !email) {
      toast.error('Full name and email are required')
      return
    }
    try {
      const resp = await api.post<Member>('/members', {
        full_name: fullName,
        email,
        phone: phone || null,
        username: username || null,
        password: username ? password : null,
      })
      toast.success('Member added')
      if (resp.data.username) {
        setCreatedCredentials({ username: resp.data.username, password })
      } else {
        setOpen(false)
        resetForm()
      }
      load()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Failed to add member')
    }
  }

  const handleCopyCredentials = () => {
    if (!createdCredentials) return
    navigator.clipboard
      .writeText(`Username: ${createdCredentials.username}\nPassword: ${createdCredentials.password}`)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('Could not copy to clipboard'))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">{pageInfo.total} registered readers</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) resetForm()
          }}
        >
          <DialogTrigger
            render={
              <Button>
                <Plus className="size-4" />
                Add member
              </Button>
            }
          />
          <DialogContent>
            {createdCredentials ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-4" />
                    Member account created
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Share these login details with the member — the password won't be shown again.
                  </p>
                  <div className="space-y-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Username</span>
                      <span>{createdCredentials.username}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Password</span>
                      <span>{createdCredentials.password}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleCopyCredentials}>
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? 'Copied' : 'Copy credentials'}
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setOpen(false)
                      resetForm()
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Add new member</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="member-name">Full name</Label>
                    <Input
                      id="member-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="member-email">Email</Label>
                    <Input
                      id="member-email"
                      type="email"
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="member-phone">Phone</Label>
                    <Input id="member-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>

                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <KeyRound className="size-3.5" />
                      Login account (so the member can self-serve borrow)
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="member-username">Username</Label>
                      <Input
                        id="member-username"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value)
                          setUsernameTouched(true)
                        }}
                        placeholder="auto-filled from email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="member-password">Password</Label>
                      <div className="flex gap-2">
                        <Input
                          id="member-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setPassword(generatePassword())}
                          title="Generate new password"
                        >
                          <RefreshCw className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave username empty to skip creating a login account.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate}>Save</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1 min-w-40">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy((v ?? 'full_name') as SortBy)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full_name">Sort: Name</SelectItem>
            <SelectItem value="joined_at">Sort: Join date</SelectItem>
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

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && members.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Users2 className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No members found</p>
        </div>
      )}

      {!loading && members.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-start gap-3 px-4">
                <Avatar className="size-10 shrink-0">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name} />}
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {initialsOf(m.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{m.full_name}</p>
                    {m.username ? (
                      <Badge variant="outline" className="shrink-0 gap-1 px-1.5 text-[10px]">
                        <KeyRound className="size-2.5" />
                        {m.username}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0 px-1.5 text-[10px]">
                        No account
                      </Badge>
                    )}
                  </div>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <Mail className="size-3 shrink-0" />
                    {m.email}
                  </p>
                  {m.phone && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="size-3 shrink-0" />
                      {m.phone}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3 shrink-0" />
                    Joined {new Date(m.joined_at).toLocaleDateString('en-US')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && (
        <PaginationBar
          page={pageInfo.page}
          totalPages={pageInfo.total_pages}
          total={pageInfo.total}
          onPageChange={setPage}
          pageSize={pageSize}
          pageSizeOptions={[9, 18, 36]}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  )
}
