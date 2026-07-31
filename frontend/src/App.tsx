import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Loading } from './components/ui'
import { useAuth } from './lib/auth'
import type { Role } from './lib/types'
import { CustomerDetail, Customers } from './pages/Customers'
import { ClientAccounts } from './pages/ClientAccounts'
import { Dashboard } from './pages/Dashboard'
import { Enquiries } from './pages/Enquiries'
import { EnquiryDetail } from './pages/EnquiryDetail'
import { ForgotPassword, Login, Signup } from './pages/Login'
import { Home } from './pages/Home'
import { ModulePage } from './pages/Modules'
import {
  ClientActivity,
  ClientEnquiryConversation,
  ClientPortal,
  ClientProjectProgress,
  VendorPortal,
} from './pages/Portals'
import { ProjectDetail, Projects } from './pages/Projects'
import { QuotationBuilder, QuotationDetail, Quotations } from './pages/Quotations'
import { SettingsPage } from './pages/Settings'
import { Tasks } from './pages/Tasks'
import { TeamAccounts } from './pages/TeamAccounts'
import { WorkProfile } from './pages/WorkProfile'

function Protected({ children, roles, loginPath = '/login/admin' }: { children: React.ReactNode; roles?: Role[]; loginPath?: string }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to={loginPath} state={{ from: location.pathname }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === 'client' ? '/client-portal' : user.role === 'vendor' ? '/vendor-portal' : '/dashboard'} replace />
  return children
}

const workspaceRoles: Role[] = ['admin','sales_manager','interior_designer','project_manager','site_supervisor']

function Workspace({ children, roles = workspaceRoles }: { children: React.ReactNode; roles?: Role[] }) {
  return <Protected roles={roles}><AppShell>{children}</AppShell></Protected>
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Navigate to="/login/client" replace />} />
    <Route path="/login/client" element={<Login mode="client" />} />
    <Route path="/login/admin" element={<Login mode="workspace" />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/dashboard" element={<Workspace><Dashboard /></Workspace>} />
    <Route path="/profile" element={<Workspace><WorkProfile /></Workspace>} />
    <Route path="/enquiries" element={<Workspace><Enquiries /></Workspace>} />
    <Route path="/enquiries/:id" element={<Workspace><EnquiryDetail /></Workspace>} />
    <Route path="/customers" element={<Workspace><Customers /></Workspace>} />
    <Route path="/customers/:id" element={<Workspace><CustomerDetail /></Workspace>} />
    <Route path="/quotations" element={<Workspace><Quotations /></Workspace>} />
    <Route path="/quotations/new" element={<Workspace><QuotationBuilder /></Workspace>} />
    <Route path="/quotations/:id" element={<Workspace><QuotationDetail /></Workspace>} />
    <Route path="/projects" element={<Workspace><Projects /></Workspace>} />
    <Route path="/projects/:id" element={<Workspace><ProjectDetail /></Workspace>} />
    <Route path="/projects/:id/timeline" element={<Workspace><ProjectDetail /></Workspace>} />
    <Route path="/projects/:id/tasks" element={<Workspace><Tasks /></Workspace>} />
    <Route path="/projects/:id/budget" element={<Workspace><ModulePage module="payments" /></Workspace>} />
    <Route path="/projects/:id/documents" element={<Workspace><ModulePage module="documents" /></Workspace>} />
    <Route path="/tasks" element={<Workspace><Tasks /></Workspace>} />
    <Route path="/my-tasks" element={<Workspace><Tasks mine /></Workspace>} />
    <Route path="/site-visits" element={<Workspace><ModulePage module="site-visits" /></Workspace>} />
    <Route path="/site-visits/new" element={<Workspace><ModulePage module="site-visits" /></Workspace>} />
    <Route path="/designs" element={<Workspace><ModulePage module="designs" /></Workspace>} />
    <Route path="/designs/:id/approval" element={<Workspace><ModulePage module="designs" /></Workspace>} />
    <Route path="/site-reports" element={<Workspace><ModulePage module="site-reports" /></Workspace>} />
    <Route path="/documents" element={<Workspace><ModulePage module="documents" /></Workspace>} />
    <Route path="/procurement" element={<Workspace><ModulePage module="procurement" /></Workspace>} />
    <Route path="/vendors" element={<Workspace><ModulePage module="vendors" /></Workspace>} />
    <Route path="/vendors/:id" element={<Workspace><ModulePage module="vendors" /></Workspace>} />
    <Route path="/materials" element={<Workspace><ModulePage module="materials" /></Workspace>} />
    <Route path="/payments" element={<Workspace><ModulePage module="payments" /></Workspace>} />
    <Route path="/reports" element={<Workspace><ModulePage module="reports" /></Workspace>} />
    <Route path="/notifications" element={<Workspace><ModulePage module="notifications" /></Workspace>} />
    <Route path="/settings" element={<Workspace roles={['admin']}><SettingsPage /></Workspace>} />
    <Route path="/users" element={<Workspace roles={['admin']}><ClientAccounts /></Workspace>} />
    <Route path="/team-access" element={<Workspace roles={['admin']}><TeamAccounts /></Workspace>} />
    <Route path="/roles" element={<Navigate to="/settings" replace />} />
    <Route path="/client-portal" element={<Protected roles={['client','admin']} loginPath="/login/client"><ClientPortal /></Protected>} />
    <Route path="/client-activity" element={<Protected roles={['client']} loginPath="/login/client"><ClientActivity /></Protected>} />
    <Route path="/client-enquiries/:id" element={<Protected roles={['client']} loginPath="/login/client"><ClientEnquiryConversation /></Protected>} />
    <Route path="/client-projects/:id" element={<Protected roles={['client','admin']} loginPath="/login/client"><ClientProjectProgress /></Protected>} />
    <Route path="/vendor-portal" element={<Protected roles={['vendor','admin']}><VendorPortal /></Protected>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
