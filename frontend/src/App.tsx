import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AdminRoute } from '@/components/AdminRoute'
import { RequireAuth } from '@/components/RequireAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthProvider } from '@/lib/auth-context'
import { BooksPage } from '@/pages/BooksPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { LoansPage } from '@/pages/LoansPage'
import { LoginPage } from '@/pages/LoginPage'
import { MembersPage } from '@/pages/MembersPage'
import { MyLoansPage } from '@/pages/MyLoansPage'
import { StatsPage } from '@/pages/StatsPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<BooksPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/my-loans"
              element={
                <RequireAuth>
                  <MyLoansPage />
                </RequireAuth>
              }
            />
            <Route
              path="/members"
              element={
                <AdminRoute>
                  <MembersPage />
                </AdminRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <AdminRoute>
                  <CategoriesPage />
                </AdminRoute>
              }
            />
            <Route
              path="/loans"
              element={
                <AdminRoute>
                  <LoansPage />
                </AdminRoute>
              }
            />
            <Route
              path="/stats"
              element={
                <AdminRoute>
                  <StatsPage />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  )
}

export default App
