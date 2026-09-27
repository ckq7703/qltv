import {
  BookHeart,
  BookMarked,
  FolderTree,
  LayoutDashboard,
  LibraryBig,
  LogIn,
  LogOut,
  Repeat,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LoanDetailDialog } from '@/components/LoanDetailDialog'
import { NotificationBell } from '@/components/NotificationBell'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import { useAuth } from '@/lib/auth-context'

const catalogItems = [{ to: '/', label: 'Books', icon: BookMarked, adminOnly: false }]

const managementItems = [
  { to: '/members', label: 'Members', icon: Users, adminOnly: true },
  { to: '/loans', label: 'Loans', icon: Repeat, adminOnly: true },
  { to: '/categories', label: 'Categories', icon: FolderTree, adminOnly: true },
  { to: '/stats', label: 'Statistics', icon: LayoutDashboard, adminOnly: true },
]

const memberItems = [{ to: '/my-loans', label: 'My Loans', icon: BookHeart }]

export function AppLayout() {
  const { isAuthenticated, role, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { notifications, unreadCount, markAllRead } = useAdminNotifications(role === 'admin')
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LibraryBig className="size-4.5" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">QLTV</span>
                <span className="text-xs text-muted-foreground">Library Management</span>
              </div>
            </div>
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Catalog</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {catalogItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={location.pathname === item.to}
                      render={<Link to={item.to} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {role === 'admin' && (
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {managementItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        isActive={location.pathname === item.to}
                        render={<Link to={item.to} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {role === 'member' && (
            <SidebarGroup>
              <SidebarGroupLabel>My Library</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {memberItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        isActive={location.pathname === item.to}
                        render={<Link to={item.to} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="px-3 py-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {role === 'admin' ? 'LB' : 'MB'}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {role === 'admin' ? 'Librarian' : 'Member'}
                </span>
                <span className="truncate text-xs text-muted-foreground">Signed in</span>
              </div>
              {role === 'admin' && (
                <NotificationBell
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onOpen={markAllRead}
                  onSelectLoan={setSelectedLoanId}
                />
              )}
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : (
            <Button size="sm" className="w-full" onClick={() => navigate('/login')}>
              <LogIn className="size-4" />
              Log in
            </Button>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <main className="flex-1 px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </SidebarInset>

      {role === 'admin' && (
        <LoanDetailDialog
          loanId={selectedLoanId}
          onOpenChange={(open) => !open && setSelectedLoanId(null)}
        />
      )}
    </SidebarProvider>
  )
}
