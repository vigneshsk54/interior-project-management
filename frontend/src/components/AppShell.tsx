import { useQuery } from '@tanstack/react-query'
import {
  Activity, Bell, Boxes, BriefcaseBusiness, CalendarDays, ChevronDown, CircleDollarSign,
  ClipboardCheck, Command, FileBarChart, FileText, FolderOpen, HardHat,
  LayoutDashboard, Menu, PackageSearch, Palette, PanelLeftClose, Search, Settings,
  UserCog, Users, UsersRound, X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Role } from '../lib/types'

interface NavItem {
  label: string
  to: string
  icon: typeof LayoutDashboard
  roles?: Role[]
}
interface NavGroup { label: string; items: NavItem[] }

const nav: NavGroup[] = [
  { label: 'Overview', items: [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'My activity', to: '/profile', icon: Activity },
    { label: 'My tasks', to: '/my-tasks', icon: ClipboardCheck, roles: ['interior_designer', 'project_manager', 'site_supervisor'] },
  ]},
  { label: 'Sales', items: [
    { label: 'Enquiries', to: '/enquiries', icon: UsersRound },
    { label: 'Customers', to: '/customers', icon: Users, roles: ['sales_manager'] },
    { label: 'Site visits', to: '/site-visits', icon: CalendarDays, roles: ['sales_manager', 'site_supervisor'] },
    { label: 'Quotations', to: '/quotations', icon: FileText, roles: ['sales_manager'] },
  ]},
  { label: 'Delivery', items: [
    { label: 'Projects', to: '/projects', icon: BriefcaseBusiness },
    { label: 'Task board', to: '/tasks', icon: ClipboardCheck, roles: ['interior_designer', 'project_manager', 'site_supervisor'] },
    { label: 'Design approvals', to: '/designs', icon: Palette, roles: ['interior_designer', 'project_manager'] },
    { label: 'Site progress', to: '/site-reports', icon: HardHat, roles: ['project_manager', 'site_supervisor'] },
    { label: 'Documents', to: '/documents', icon: FolderOpen },
  ]},
  { label: 'Operations', items: [
    { label: 'Procurement', to: '/procurement', icon: PackageSearch, roles: ['project_manager'] },
    { label: 'Vendors', to: '/vendors', icon: Boxes, roles: ['project_manager'] },
    { label: 'Materials', to: '/materials', icon: Boxes, roles: ['project_manager', 'site_supervisor'] },
    { label: 'Payments', to: '/payments', icon: CircleDollarSign, roles: ['project_manager'] },
    { label: 'Reports', to: '/reports', icon: FileBarChart },
  ]},
]

interface Notification { id: string; title: string; message: string; read_at?: string; created_at: string; link?: string }

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<Notification[]>('/notifications/list'),
    refetchInterval: 5000,
  })
  const canSee = useCallback(
    (item: NavItem) => user?.role === 'admin' || !item.roles || item.roles.includes(user?.role as Role),
    [user?.role],
  )

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setCommandOpen((value) => !value)
      }
      if (event.key === 'Escape') {
        setCommandOpen(false)
        setNotificationsOpen(false)
        setProfileOpen(false)
        setMobileOpen(false)
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const links = useMemo(() => {
    const available = nav.flatMap((group) => group.items).filter(canSee)
    if (!query) return available
    return available.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
  }, [canSee, query])
  const openNotification = async (item: Notification) => {
    if (!item.read_at) await api(`/notifications/${item.id}/read`, { method: 'POST' })
    setNotificationsOpen(false)
    if (item.link) navigate(item.link)
    notifications.refetch()
  }

  const sidebar = (compact: boolean) => (
    <>
      <div className="flex h-[74px] items-center gap-3 border-b border-line px-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-sm font-bold text-white shadow-[0_8px_24px_rgba(124,92,255,.25)]">AF</div>
        {!compact && <div><p className="font-semibold tracking-tight text-white">Atelier Flow</p><p className="text-[10px] uppercase tracking-[.16em] text-content-muted">Project operations</p></div>}
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto p-3">
        {nav.map((group) => <div className="mb-5" key={group.label}>
          {!compact && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-content-muted">{group.label}</p>}
          <div className="space-y-1">{group.items.filter(canSee).map(({ label, to, icon: Icon }) =>
            <NavLink key={to} to={to} title={compact ? label : undefined} className={({ isActive }) => `relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition duration-220 ${isActive ? 'bg-brand/15 font-medium text-white ring-1 ring-inset ring-brand/20' : 'text-content-muted hover:bg-white/[0.05] hover:text-content'} ${compact ? 'justify-center' : ''}`}>
              <Icon className="h-[18px] w-[18px] shrink-0" />{!compact && <span>{label}</span>}
            </NavLink>)}</div>
        </div>)}
        {user?.role === 'admin' && <div className="space-y-1"><NavLink to="/users" title={compact ? 'Client access' : undefined} className={({ isActive }) => `flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition duration-220 ${isActive ? 'bg-brand/15 text-white ring-1 ring-inset ring-brand/20' : 'text-content-muted hover:bg-white/[0.05] hover:text-white'} ${compact ? 'justify-center' : ''}`}><Users className="h-[18px] w-[18px]" />{!compact && 'Client access'}</NavLink><NavLink to="/team-access" title={compact ? 'Team access' : undefined} className={({ isActive }) => `flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition duration-220 ${isActive ? 'bg-brand/15 text-white ring-1 ring-inset ring-brand/20' : 'text-content-muted hover:bg-white/[0.05] hover:text-white'} ${compact ? 'justify-center' : ''}`}><UserCog className="h-[18px] w-[18px]" />{!compact && 'Team access'}</NavLink><NavLink to="/settings" title={compact ? 'Settings' : undefined} className={({ isActive }) => `flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition duration-220 ${isActive ? 'bg-brand/15 text-white ring-1 ring-inset ring-brand/20' : 'text-content-muted hover:bg-white/[0.05] hover:text-white'} ${compact ? 'justify-center' : ''}`}><Settings className="h-[18px] w-[18px]" />{!compact && 'Settings'}</NavLink></div>}
      </nav>
      {compact === collapsed && <button onClick={() => setCollapsed(!collapsed)} className={`hidden h-12 items-center gap-3 border-t border-line text-xs text-content-muted transition hover:bg-white/[0.035] hover:text-white lg:flex ${compact ? 'justify-center px-3' : 'px-5'}`} aria-label={compact ? 'Expand navigation' : 'Collapse navigation'}>
        <PanelLeftClose className={`h-4 w-4 transition-transform ${compact ? 'rotate-180' : ''}`} />{!compact && 'Collapse menu'}
      </button>}
    </>
  )

  return <div className="min-h-screen bg-app">
    <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-subtle transition-all duration-220 lg:flex lg:flex-col ${collapsed ? 'w-[72px]' : 'w-[244px]'}`}>{sidebar(collapsed)}</aside>
    {mobileOpen && <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation"><button aria-label="Close navigation" className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><aside className="relative flex w-[min(288px,86vw)] flex-col border-r border-line bg-subtle shadow-elevated">{sidebar(false)}</aside></div>}
    <div className={`transition-[padding] duration-220 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[244px]'}`}>
      <header className="sticky top-0 z-30 flex h-[74px] items-center gap-3 border-b border-line bg-app/90 px-4 backdrop-blur-xl sm:px-7">
        <button className="icon-btn lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
        <button onClick={() => setCommandOpen(true)} className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-panel px-3 text-left text-sm text-content-muted shadow-sm transition duration-220 hover:border-brand/30 hover:text-content-secondary sm:max-w-md" aria-haspopup="dialog">
          <Search className="h-4 w-4 shrink-0" /><span className="truncate">Search projects, people, documents…</span><span className="ml-auto hidden items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[10px] sm:flex"><Command className="h-3 w-3" />K</span>
        </button>
        <div className="relative">
          <button className="icon-btn relative" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications" aria-expanded={notificationsOpen} aria-haspopup="menu"><Bell className="h-[18px] w-[18px]" />{notifications.data?.some((item) => !item.read_at) && <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-panel bg-brand" />}</button>
          {notificationsOpen && <div className="absolute right-0 top-12 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-line bg-panel shadow-xl">
            <div className="flex items-center justify-between border-b border-line p-4"><p className="font-semibold">Notifications</p><button onClick={() => setNotificationsOpen(false)} className="icon-btn h-8 w-8" aria-label="Close notifications"><X className="h-4 w-4" /></button></div>
            <div className="max-h-[390px] overflow-auto">{notifications.data?.length ? notifications.data.map((item) => <button onClick={() => openNotification(item)} key={item.id} className="block w-full border-b border-line p-4 text-left last:border-0 hover:bg-white/[0.05]"><div className="flex gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? 'bg-white/[0.09]' : 'bg-brand'}`} /><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-content-secondary">{item.message}</p></div></div></button>) : <p className="p-8 text-center text-sm text-content-secondary">You’re all caught up.</p>}</div>
          </div>}
        </div>
        <div className="relative">
          <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-xl p-1.5 transition duration-220 hover:bg-white/[0.06]" aria-expanded={profileOpen} aria-haspopup="menu"><div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary to-brand-light text-xs font-bold text-white">{user?.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="hidden text-left md:block"><p className="max-w-[120px] truncate text-xs font-semibold">{user?.full_name}</p><p className="text-[10px] capitalize text-content-secondary">{user?.role.replaceAll('_', ' ')}</p></div><ChevronDown className={`hidden h-4 w-4 text-content-muted transition-transform md:block ${profileOpen ? 'rotate-180' : ''}`} /></button>
          {profileOpen && <div className="absolute right-0 top-12 w-52 rounded-xl border border-line bg-panel p-2 shadow-xl"><button onClick={() => { navigate('/profile'); setProfileOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/[0.05]"><Activity className="h-4 w-4" />My activity</button>{user?.role === 'admin' && <button onClick={() => { navigate('/settings'); setProfileOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/[0.05]"><Settings className="h-4 w-4" />Preferences</button>}<button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-400/10">Sign out</button></div>}
        </div>
      </header>
      <main className="page-container"><div className="fade-in">{children}</div></main>
    </div>
    {commandOpen && <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/65 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setCommandOpen(false)} role="dialog" aria-modal="true" aria-label="Quick navigation"><div className="w-full max-w-xl overflow-hidden rounded-card border border-line bg-panel shadow-elevated" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-center gap-3 border-b border-line px-4"><Search className="h-5 w-5 text-content-muted" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className="h-14 flex-1 bg-transparent text-content outline-none placeholder:text-content-muted" placeholder="Go to a module…" /><button onClick={() => setCommandOpen(false)} className="text-xs text-content-muted hover:text-content" aria-label="Close quick navigation">ESC</button></div><div className="max-h-80 overflow-auto p-2">{links.map(({ label, to, icon: Icon }) => <button key={to} onClick={() => { navigate(to); setCommandOpen(false); setQuery('') }} className="flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm transition hover:bg-white/[0.05]"><span className="rounded-lg border border-brand/15 bg-brand/10 p-2 text-brand-light"><Icon className="h-4 w-4" /></span>{label}</button>)}</div></div></div>}
  </div>
}
