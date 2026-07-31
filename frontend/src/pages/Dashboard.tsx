import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CalendarPlus, CheckCircle2, CircleDollarSign, FolderKanban, Target, UsersRound } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, compactMoney, humanize } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Project, Task } from '../lib/types'
import { chartColors, chartTooltipStyle, theme } from '../lib/theme'
import { Badge, Card, Empty, ErrorState, Loading, PageHeader, Progress, SectionHeader, StatCard } from '../components/ui'

export interface ScheduledProject {
  id: string
  reference: string
  client_reference: string
  title: string
  client_name: string
  email: string
  property_type: string
  location: string
  expected_start_date?: string
  status: string
  created_at: string
}

interface DashboardData {
  metrics: Record<string, number>
  funnel: { name: string; value: number }[]
  revenue: { month: string; value: number }[]
  projects: Project[]
  deadlines: Task[]
  scheduled_projects: ScheduledProject[]
}
export function Dashboard() {
  const { user } = useAuth()
  const [days, setDays] = useState('30')
  const [status, setStatus] = useState('')
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - Number(days) + 1)
  const dateParam = (value: Date) => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const query = new URLSearchParams({ date_from: dateParam(from), date_to: dateParam(today) })
  if (status) query.set('status', status)
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', days, status],
    queryFn: () => api<DashboardData>(`/dashboard?${query}`),
  })
  if (isLoading) return <Loading />
  if (error) return <ErrorState error={error} />
  if (!data) return null
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(today)
  const metricCards = [
    ['Active projects', data.metrics.active_projects, FolderKanban, `${data.metrics.projects_due_this_month} due this month`],
    ['Client scheduled', data.metrics.client_scheduled_projects, CalendarPlus, 'Project requests awaiting studio conversion'],
    ['New enquiries', data.metrics.new_enquiries, UsersRound, `Within the selected ${days} days`],
    ['Conversion rate', `${data.metrics.conversion_rate}%`, Target, `${data.metrics.new_enquiries} new enquiries in this period`],
    ['Projects at risk', data.metrics.projects_at_risk, AlertTriangle, `${data.metrics.overdue_tasks} overdue tasks`],
    ['Pending approvals', data.metrics.pending_approvals, CheckCircle2, `${data.metrics.tasks_due_soon} tasks due in 7 days`],
    ['Outstanding', compactMoney(data.metrics.outstanding_payments), CircleDollarSign, `${data.metrics.payment_milestones} open payment records`],
  ] as const
  return <>
    <PageHeader eyebrow={formattedDate} title={`${greeting}, ${user?.full_name?.split(' ')[0] || 'there'}`} description="Here’s the current pulse of your studio and what needs attention." action={<div className="flex gap-2"><select aria-label="Dashboard date range" className="input w-40" value={days} onChange={(event) => setDays(event.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select><select aria-label="Project status" className="input hidden w-36 sm:block" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option></select></div>} />
    <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map(([label, value, Icon, note]) => <StatCard key={label} label={label} value={value} icon={Icon} note={note} />)}</div>
    <ClientScheduledProjects items={data.scheduled_projects} />
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Card variant="chart"><SectionHeader title="Monthly revenue" description="Recorded payment collections in ₹ lakh" /><div className="h-[300px] min-w-0 px-2 pb-5 pt-6 sm:px-5"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.revenue} margin={{ left: -12, right: 12 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={theme.brand} stopOpacity={.35}/><stop offset="100%" stopColor={theme.brand} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke={theme.border} vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: theme.textMuted, fontSize: 12 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: theme.textMuted, fontSize: 12 }}/><Tooltip contentStyle={chartTooltipStyle}/><Area type="monotone" dataKey="value" stroke={theme.brandLight} strokeWidth={2.5} fill="url(#revenueFill)"/></AreaChart></ResponsiveContainer></div></Card>
      <Card variant="chart"><SectionHeader title="Enquiry funnel" description="Current pipeline distribution" /><div className="h-[300px] min-w-0 px-3 pb-5 pt-5 sm:px-5"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.funnel} layout="vertical" margin={{ left: 5, right: 10 }}><XAxis type="number" hide/><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={100} tick={{ fill: theme.textSecondary, fontSize: 11 }}/><Tooltip cursor={{ fill: 'rgba(255,255,255,.035)' }} contentStyle={chartTooltipStyle}/><Bar dataKey="value" radius={[0, 7, 7, 0]} barSize={14}>{data.funnel.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div></Card>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
      <Card className="overflow-hidden"><SectionHeader title="Project health" description="Delivery progress from project records" action={<Link className="text-xs font-semibold text-brand-light hover:text-white" to="/projects">View all</Link>} /><div className="divide-y divide-line">{data.projects.length ? data.projects.map((project) => <Link to={`/projects/${project.id}`} key={project.id} className="block p-4 transition-colors hover:bg-white/[0.05] sm:px-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{project.name}</p><p className="mt-1 text-xs text-content-secondary">{humanize(project.stage)} · {project.location}</p></div><Badge value={project.health} /></div><div className="mt-3 flex items-center gap-3"><Progress value={project.progress} /><span className="text-xs font-semibold">{project.progress}%</span></div></Link>) : <Empty title="No projects match these filters" />}</div></Card>
      <Card className="overflow-hidden"><SectionHeader title="Upcoming deadlines" description="Open tasks ordered by due date" /><div className="divide-y divide-line">{data.deadlines.length ? data.deadlines.map((task) => <div key={task.id} className="flex gap-3 p-4 sm:px-6"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand/20 bg-brand/10"><CalendarClock className="h-4 w-4 text-brand-light" /></div><div className="min-w-0"><p className="truncate text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-content-secondary">{task.due_date || 'No due date'} · {humanize(task.priority)}</p></div></div>) : <Empty title="No open deadlines" />}</div></Card>
    </div>
  </>
}

export function ClientScheduledProjects({ items }: { items: ScheduledProject[] }) {
  return <Card className="mt-5 overflow-hidden"><SectionHeader title="Client-scheduled projects" description="Project requests submitted from the client portal, ordered by expected start date." action={<Link className="text-xs font-semibold text-brand-light hover:text-white" to="/enquiries">View all enquiries</Link>} /><div className="divide-y divide-line">{items.length ? items.map((item) => <Link to={`/enquiries/${item.id}`} className="grid gap-4 p-4 transition hover:bg-white/[0.04] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6" key={item.id}><span className="grid h-10 w-10 place-items-center rounded-xl border border-brand/20 bg-brand/10"><CalendarPlus className="h-5 w-5 text-brand-light" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.title}</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]"><span className="text-content-muted">Studio: <strong className="text-content-secondary">{item.reference}</strong></span><span className="text-content-muted">{item.client_name}: <strong className="text-content-secondary">{item.client_reference}</strong></span></div><p className="mt-1 text-xs text-content-secondary">{item.client_name} · {item.property_type} · {item.location}</p></div><div className="flex items-center justify-between gap-4 sm:block sm:text-right"><div><p className="text-[10px] uppercase tracking-wider text-content-muted">Expected start</p><p className="mt-1 text-xs font-semibold">{item.expected_start_date ? new Date(`${item.expected_start_date}T00:00:00`).toLocaleDateString('en-IN') : 'To be confirmed'}</p></div><div className="sm:mt-2"><Badge value={item.status} /></div></div></Link>) : <Empty title="No client-scheduled projects" message="New project requests submitted by clients will appear here automatically." />}</div></Card>
}
