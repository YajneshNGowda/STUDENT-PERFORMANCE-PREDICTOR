import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import StudentsPage from './pages/Students'
import AlertsPage from './pages/Alerts'
import ModelPage from './pages/Model'
import { UsersPage, SettingsPage } from './pages/Users'
import DepartmentsPage from './pages/Departments'
import DepartmentDetailPage from './pages/DepartmentDetail'
import StudentPortal from './pages/StudentPortal'
import RiskAnalysisPage from './pages/RiskAnalysis'
import { Spinner } from './components/ui/index.jsx'

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary dark:bg-surface-dark">
      <Spinner size="lg" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <AppLayout>{children}</AppLayout>
}

function AppRoutes() {
  const { user, isStudent, isParent } = useAuth()
  if (!user) return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
  // Student/parent → portal only
  if (isStudent || isParent) return (
    <Routes>
      <Route path="/my-profile" element={<AppLayout><StudentPortal /></AppLayout>} />
      <Route path="*" element={<Navigate to="/my-profile" />} />
    </Routes>
  )
  // Staff routes
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard"  element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/students"   element={<ProtectedRoute><StudentsPage /></ProtectedRoute>} />
      <Route path="/students/:id/risk" element={<ProtectedRoute><RiskAnalysisPage /></ProtectedRoute>} />
      <Route path="/alerts"     element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
      <Route path="/model"      element={<ProtectedRoute><ModelPage /></ProtectedRoute>} />
      <Route path="/users"      element={<ProtectedRoute roles={['super_admin','hod']}><UsersPage /></ProtectedRoute>} />
      <Route path="/departments" element={<ProtectedRoute roles={['super_admin']}><DepartmentsPage /></ProtectedRoute>} />
      <Route path="/departments/:code" element={<ProtectedRoute><DepartmentDetailPage /></ProtectedRoute>} />
      <Route path="/settings"   element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{
            style:{ fontSize:'13px', borderRadius:'10px' },
            success:{ duration:3000 }, error:{ duration:5000 },
          }} />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
