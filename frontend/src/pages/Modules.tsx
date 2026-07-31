import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, Boxes, CalendarDays, CircleDollarSign, Download, FileBarChart, FileText,
  FolderOpen, HardHat, PackageSearch, Palette, Plus, Settings, ShieldCheck, Star,
  Users, Wrench, X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { api, download, compactMoney } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Paginated, Project } from '../lib/types'
import { normalizeEmailCase } from '../lib/validation'
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader, Progress, StatCard } from '../components/ui'

const config = {
  'site-visits': { title: 'Site visits', eyebrow: 'Field planning', description: 'Schedule measurements, assign the team and turn observations into clear site reports.', icon: CalendarDays },
  designs: { title: 'Design gallery', eyebrow: 'Creative approvals', description: 'Review concepts, drawings and renders with a complete version and approval history.', icon: Palette },
  'site-reports': { title: 'Site progress', eyebrow: 'Execution journal', description: 'Daily progress, labour, materials, blockers, safety notes and site photography.', icon: HardHat },
  documents: { title: 'Documents', eyebrow: 'Project records', description: 'A controlled home for drawings, contracts, invoices, reports and client files.', icon: FolderOpen },
  procurement: { title: 'Procurement', eyebrow: 'Supply chain', description: 'Plan requests, compare vendors, release orders and track every delivery.', icon: PackageSearch },
  vendors: { title: 'Vendors', eyebrow: 'Partner network', description: 'Manage trade partners, commercial records, quality and delivery performance.', icon: Users },
  materials: { title: 'Materials', eyebrow: 'Inventory control', description: 'Track catalogues, requirements, orders, consumption, returns and low stock.', icon: Boxes },
  payments: { title: 'Payments', eyebrow: 'Project finance', description: 'Stay ahead of client collections, vendor dues, cash flow and profitability.', icon: CircleDollarSign },
  reports: { title: 'Reports & analytics', eyebrow: 'Business intelligence', description: 'Understand conversion, delivery, capacity, margins and partner performance.', icon: FileBarChart },
  notifications: { title: 'Notifications', eyebrow: 'Activity centre', description: 'All approvals, deadlines, reminders and workflow events in one feed.', icon: Bell },
  settings: { title: 'Settings', eyebrow: 'Administration', description: 'Configure users, permissions, stages, templates, branding and automations.', icon: Settings },
} as const

export type ModuleKey = keyof typeof config
interface RecordItem { id: string; reference: string; title: string; status: string; due_date?: string; amount?: number; data?: { progress?: number }; created_at?: string; updated_at?: string }
interface Vendor { id: string; name: string; category: string; rating: number; on_time_rate: number; status: string; email: string; created_at?: string; updated_at?: string }
interface Material { id: string; sku: string; name: string; category: string; brand?: string; unit_price: number; stock_quantity: number; reorder_level: number; created_at?: string; updated_at?: string }
interface Design { id: string; title: string; room: string; stage: string; status: string; created_at?: string; updated_at?: string }
interface DocumentItem { id: string; name: string; category: string; mime_type: string; size_bytes: number; file_url: string; created_at?: string; updated_at?: string }
interface NotificationItem { id: string; title: string; message: string; category: string; read_at?: string; created_at: string }
interface SettingItem { id: string; key: string; value: Record<string, unknown>; created_at?: string; updated_at?: string }
interface ReportData {
  lead_sources: { source: string; count: number }[]
  vendor_performance: { name: string; rating: number; on_time_rate: number }[]
  payment_statuses: { status: string; count: number; amount: number }[]
}

const initialForm = {
  title: '', reference: '', status: 'pending', due_date: '', amount: '', project_id: '',
  name: '', category: '', email: '', phone: '', tax_id: '', rating: '0', on_time_rate: '0',
  sku: '', brand: '', unit: '', unit_price: '', stock_quantity: '', reorder_level: '',
  room: '', stage: '', setting_key: '', setting_value: '',
}

export function ModulePage({ module }: { module: ModuleKey }) {
  const { user } = useAuth()
  const item = config[module]
  const Icon = item.icon
  const client = useQueryClient()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [file, setFile] = useState<File | null>(null)
  useEffect(() => {
    if (location.pathname.endsWith('/new')) setOpen(true)
  }, [location.pathname])
  const query = useQuery({
    queryKey: [module],
    queryFn: async () => {
      if (module === 'vendors') return api<Vendor[]>('/vendors/list')
      if (module === 'materials') return api<Material[]>('/materials/list')
      if (module === 'designs') return api<Design[]>('/designs/list')
      if (module === 'documents') return api<DocumentItem[]>('/documents/list')
      if (module === 'notifications') return api<NotificationItem[]>('/notifications/list')
      if (module === 'reports') return api<ReportData>('/reports/overview')
      if (module === 'settings') return api<SettingItem[]>('/settings/list')
      return api<Paginated<RecordItem>>(`/${module}`)
    },
  })
  const projects = useQuery({
    queryKey: ['projects', 'module-options'],
    queryFn: () => api<Paginated<Project>>('/projects?page_size=100'),
    enabled: open && ['designs', 'documents', 'procurement', 'site-reports', 'payments', 'site-visits'].includes(module),
  })
  const add = useMutation({
    mutationFn: async () => {
      if (module === 'vendors') return api('/vendors', { method: 'POST', body: JSON.stringify({
        name: form.name, category: form.category, email: form.email, phone: form.phone,
        tax_id: form.tax_id || null, rating: Number(form.rating), on_time_rate: Number(form.on_time_rate),
      }) })
      if (module === 'materials') return api('/materials', { method: 'POST', body: JSON.stringify({
        sku: form.sku, name: form.name, category: form.category, brand: form.brand || null,
        unit: form.unit, unit_price: Number(form.unit_price || 0), stock_quantity: Number(form.stock_quantity || 0),
        reorder_level: Number(form.reorder_level || 0),
      }) })
      if (module === 'designs') return api('/designs', { method: 'POST', body: JSON.stringify({
        title: form.title, project_id: form.project_id, room: form.room, stage: form.stage, status: form.status,
      }) })
      if (module === 'documents') {
        if (!file) throw new Error('Choose a file to upload')
        const body = new FormData()
        body.append('file', file)
        const projectQuery = form.project_id ? `&project_id=${form.project_id}` : ''
        return api(`/documents/upload?category=${encodeURIComponent(form.category || 'general')}${projectQuery}`, { method: 'POST', body })
      }
      if (module === 'settings') {
        let value: unknown = form.setting_value
        try { value = JSON.parse(form.setting_value) } catch { value = { value: form.setting_value } }
        return api(`/settings/${encodeURIComponent(form.setting_key)}`, { method: 'PUT', body: JSON.stringify({ value: typeof value === 'object' && value !== null ? value : { value } }) })
      }
      const reference = form.reference || `${module.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`
      return api(`/${module}`, { method: 'POST', body: JSON.stringify({
        record_type: module.replace(/s$/, ''), reference, title: form.title,
        project_id: form.project_id || null, status: form.status, due_date: form.due_date || null,
        amount: form.amount ? Number(form.amount) : null,
        data: { enquiry_id: searchParams.get('enquiry') || undefined, progress: 0 },
      }) })
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [module] })
      setOpen(false)
      setForm(initialForm)
      setFile(null)
    },
  })
  const markAllRead = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const canCreate = user?.role === 'admin'
    || (module === 'vendors' && user?.role === 'project_manager')
    || (module === 'materials' && user?.role === 'site_supervisor')
    || (module === 'designs' && user?.role === 'interior_designer')
    || ['documents', 'site-visits', 'site-reports', 'procurement', 'payments'].includes(module)
  const summary = liveSummary(module, query.data)
  const action = useMemo(() => {
    if (module === 'reports') return <Button onClick={() => download('/reports/export.csv', 'atelier-flow-project-report.csv')}><Download className="h-4 w-4" />Export CSV</Button>
    if (module === 'notifications') return <Button variant="secondary" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>Mark all read</Button>
    if (!canCreate) return undefined
    return <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{module === 'documents' ? 'Upload file' : module === 'settings' ? 'Add setting' : 'Add new'}</Button>
  }, [canCreate, markAllRead, module])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    add.mutate()
  }
  return <>
    <PageHeader eyebrow={item.eyebrow} title={item.title} description={item.description} action={action} />
    <div className="mb-5 grid auto-rows-fr gap-4 sm:grid-cols-3"><StatCard label="Total records" value={summary.total} icon={Icon} /><StatCard label="Needs attention" value={summary.attention} icon={Wrench} /><StatCard label="Completed this month" value={summary.completed} icon={ShieldCheck} /></div>
    {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : module === 'vendors' ? <VendorGrid items={query.data as Vendor[]} /> : module === 'materials' ? <MaterialTable items={query.data as Material[]} /> : module === 'designs' ? <DesignGrid items={query.data as Design[]} /> : module === 'documents' ? <Documents items={query.data as DocumentItem[]} /> : module === 'notifications' ? <Notifications items={query.data as NotificationItem[]} /> : module === 'reports' ? <Reports data={query.data as ReportData} /> : module === 'settings' ? <SettingsView items={query.data as SettingItem[]} onConfigure={(key, value) => { setForm({ ...initialForm, setting_key: key, setting_value: JSON.stringify(value, null, 2) }); setOpen(true) }} /> : <RecordTable module={module} items={(query.data as Paginated<RecordItem>)?.items || []} />}
    {open && <ModuleForm module={module} form={form} setForm={setForm} projects={projects.data?.items || []} file={file} setFile={setFile} close={() => setOpen(false)} submit={submit} pending={add.isPending} error={add.error} />}
  </>
}

function ModuleForm({ module, form, setForm, projects, file, setFile, close, submit, pending, error }: { module: ModuleKey; form: typeof initialForm; setForm: (value: typeof initialForm) => void; projects: Project[]; file: File | null; setFile: (file: File | null) => void; close: () => void; submit: (event: FormEvent) => void; pending: boolean; error: Error | null }) {
  const projectSelect = <label><span className="label">Project</span><select className="input" value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })}><option value="">Select project</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><button className="absolute inset-0" aria-label="Close" onClick={close} /><form onSubmit={submit} className="surface relative max-h-[90vh] w-full max-w-2xl overflow-auto p-6 sm:p-8"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-brand">Create record</p><h2 className="mt-1 text-xl font-semibold">{config[module].title}</h2></div><button type="button" className="icon-btn" onClick={close} aria-label="Close dialog"><X className="h-4 w-4" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">
    {module === 'vendors' && <><Field label="Vendor name" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Field label="Category" required value={form.category} onChange={(value) => setForm({ ...form, category: value })} /><Field label="Email" type="email" required value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><Field label="Phone" required value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Field label="Tax ID" value={form.tax_id} onChange={(value) => setForm({ ...form, tax_id: value })} /><Field label="On-time rate %" type="number" value={form.on_time_rate} onChange={(value) => setForm({ ...form, on_time_rate: value })} /></>}
    {module === 'materials' && <><Field label="SKU" required value={form.sku} onChange={(value) => setForm({ ...form, sku: value })} /><Field label="Material name" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Field label="Category" required value={form.category} onChange={(value) => setForm({ ...form, category: value })} /><Field label="Brand" value={form.brand} onChange={(value) => setForm({ ...form, brand: value })} /><Field label="Unit" required value={form.unit} onChange={(value) => setForm({ ...form, unit: value })} /><Field label="Unit price" type="number" value={form.unit_price} onChange={(value) => setForm({ ...form, unit_price: value })} /><Field label="Opening stock" type="number" value={form.stock_quantity} onChange={(value) => setForm({ ...form, stock_quantity: value })} /><Field label="Reorder level" type="number" value={form.reorder_level} onChange={(value) => setForm({ ...form, reorder_level: value })} /></>}
    {module === 'designs' && <><div>{projectSelect}</div><Field label="Title" required value={form.title} onChange={(value) => setForm({ ...form, title: value })} /><Field label="Room" required value={form.room} onChange={(value) => setForm({ ...form, room: value })} /><Field label="Design stage" required value={form.stage} onChange={(value) => setForm({ ...form, stage: value })} /></>}
    {module === 'documents' && <><div>{projectSelect}</div><Field label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value })} /><label className="sm:col-span-2"><span className="label">File</span><input className="input py-2" required type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} /><span className="mt-1 block text-xs text-content-muted">{file?.name || 'PDF, image, or XLSX up to 20 MB'}</span></label></>}
    {module === 'settings' && <><Field label="Setting key" required value={form.setting_key} onChange={(value) => setForm({ ...form, setting_key: value })} /><label className="sm:col-span-2"><span className="label">JSON value or text</span><textarea className="input h-36 py-3 font-mono text-xs" required value={form.setting_value} onChange={(event) => setForm({ ...form, setting_value: event.target.value })} /></label></>}
    {!['vendors', 'materials', 'designs', 'documents', 'settings'].includes(module) && <><label className="sm:col-span-2"><span className="label">Title</span><input className="input" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><Field label="Reference (optional)" value={form.reference} onChange={(value) => setForm({ ...form, reference: value })} /><div>{projectSelect}</div><Field label="Due date" type="date" value={form.due_date} onChange={(value) => setForm({ ...form, due_date: value })} /><Field label="Amount" type="number" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} /></>}
  </div>{error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error.message}</p>}<div className="mt-6 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button></div></form></div>
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label><span className="label">{label}</span><input className="input" min={type === 'number' ? 0 : undefined} type={type} autoCapitalize={type === 'email' ? 'none' : undefined} required={required} value={value} onChange={(event) => onChange(type === 'email' ? normalizeEmailCase(event.target.value) : event.target.value)} /></label>
}

function liveSummary(module: ModuleKey, data: unknown) {
  if (!data) return { total: 0, attention: 0, completed: 0 }
  if (!Array.isArray(data) && typeof data === 'object' && 'summary' in data) {
    return (data as { summary: { total: number; attention: number; completed: number } }).summary
  }
  if (module === 'reports') {
    const reports = data as ReportData
    return {
      total: reports.lead_sources?.reduce((sum, item) => sum + item.count, 0) || 0,
      attention: reports.vendor_performance?.filter((item) => item.rating < 3 || item.on_time_rate < 80).length || 0,
      completed: reports.payment_statuses?.filter((item) => ['approved', 'completed', 'paid', 'received'].includes(item.status)).reduce((sum, item) => sum + item.count, 0) || 0,
    }
  }
  const records = (Array.isArray(data) ? data : (data as { items?: unknown[] }).items || []) as Array<Record<string, unknown>>
  const current = new Date()
  const isCurrentMonth = (value: unknown) => {
    if (typeof value !== 'string') return false
    const parsed = new Date(value)
    return parsed.getFullYear() === current.getFullYear() && parsed.getMonth() === current.getMonth()
  }
  const attention = records.filter((record) => {
    const status = String(record.status || '')
    if (['overdue', 'critical', 'blocked', 'rejected'].includes(status)) return true
    if (module === 'materials') return Number(record.stock_quantity) <= Number(record.reorder_level)
    if (module === 'notifications') return !record.read_at
    if (module === 'vendors') return status !== 'active' || Number(record.rating) < 3 || Number(record.on_time_rate) < 80
    return module === 'designs' && status === 'pending_approval'
  }).length
  const completed = records.filter((record) => {
    const status = String(record.status || '')
    const completionDate = record.updated_at || record.read_at || record.created_at
    return (['approved', 'completed', 'paid', 'received', 'delivered'].includes(status) || (module === 'notifications' && Boolean(record.read_at)))
      && isCurrentMonth(completionDate)
  }).length
  const total = Array.isArray(data) ? records.length : Number((data as { total?: number }).total || records.length)
  return { total, attention, completed }
}

function RecordTable({ items, module }: { items: RecordItem[]; module: ModuleKey }) {
  const client = useQueryClient()
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/${module}/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: [module] }),
  })
  if (!items.length) return <Card><Empty /></Card>
  return <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-white/[0.035] text-[11px] uppercase tracking-wider text-content-secondary"><tr><th className="px-5 py-4">Reference</th><th className="px-4">Record</th><th className="px-4">Due date</th><th className="px-4">Amount</th><th className="px-4">Status</th></tr></thead><tbody className="divide-y divide-line">{items.map((item) => <tr className="hover:bg-white/[0.05]" key={item.id}><td className="px-5 py-4 text-xs text-content-muted">{item.reference}</td><td className="px-4 py-4 font-semibold">{item.title}{item.data?.progress !== undefined && <div className="mt-2 max-w-[180px]"><Progress value={item.data.progress} /></div>}</td><td className="px-4 py-4 text-content-secondary">{item.due_date || '—'}</td><td className="px-4 py-4">{item.amount ? compactMoney(item.amount) : '—'}</td><td className="px-4 py-4"><select className="h-8 rounded-lg border border-line bg-panel px-2 text-xs" value={item.status} onChange={(event) => update.mutate({ id: item.id, status: event.target.value })}><option>draft</option><option>pending</option><option>approved</option><option>in_progress</option><option>completed</option><option>overdue</option></select></td></tr>)}</tbody></table></div></Card>
}

function VendorGrid({ items }: { items: Vendor[] }) { return <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((vendor) => <Card variant="interactive" className="h-full p-5" key={vendor.id}><div className="flex justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-subtle"><Users className="h-5 w-5 text-brand-light" /></span><Badge value={vendor.status} /></div><p className="mt-4 font-semibold">{vendor.name}</p><p className="mt-1 text-xs text-content-secondary">{vendor.category}</p><div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs"><span className="flex items-center gap-1 font-semibold"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{vendor.rating}</span><span className="text-content-secondary">{vendor.on_time_rate}% on time</span></div></Card>)}</div> }
function MaterialTable({ items }: { items: Material[] }) { return items.length ? <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-white/[0.035] text-[11px] uppercase tracking-wider text-content-secondary"><tr><th className="px-5 py-4">Material</th><th>Category</th><th>Stock</th><th>Unit price</th><th>Availability</th></tr></thead><tbody className="divide-y divide-line">{items.map((material) => <tr key={material.id}><td className="px-5 py-4"><p className="font-semibold">{material.name}</p><p className="text-xs text-content-muted">{material.sku} · {material.brand}</p></td><td>{material.category}</td><td>{material.stock_quantity}</td><td>{compactMoney(material.unit_price)}</td><td><Badge value={material.stock_quantity <= material.reorder_level ? 'critical' : 'on_track'} /></td></tr>)}</tbody></table></div></Card> : <Card><Empty /></Card> }
function DesignGrid({ items }: { items: Design[] }) { return items.length ? <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((design, index) => <Card variant="interactive" className="h-full overflow-hidden" key={design.id}><div className={`grid h-44 place-items-center ${['bg-gradient-to-br from-brand/35 to-brand-light/10', 'bg-gradient-to-br from-brand-secondary/30 to-brand/10', 'bg-gradient-to-br from-brand-light/25 to-brand-secondary/10'][index % 3]}`}><Palette className="h-10 w-10 text-brand-light" /></div><div className="p-5"><div className="flex justify-between gap-2"><p className="font-semibold">{design.title}</p><Badge value={design.status} /></div><p className="mt-1 text-xs text-content-secondary">{design.room} · {design.stage}</p></div></Card>)}</div> : <Card><Empty /></Card> }
function Documents({ items }: { items: DocumentItem[] }) { return items.length ? <Card className="divide-y divide-line">{items.map((item) => <div className="flex items-center gap-4 p-4" key={item.id}><span className="rounded-xl bg-subtle p-3"><FileText className="h-5 w-5 text-brand-light" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-content-muted">{item.category} · {(item.size_bytes / 1024).toFixed(1)} KB</p></div><a className="btn-secondary" href={item.file_url} download><Download className="h-4 w-4" />Download</a></div>)}</Card> : <Card><Empty /></Card> }
function Notifications({ items }: { items: NotificationItem[] }) { return items.length ? <Card className="divide-y divide-line">{items.map((item) => <div className={`flex gap-4 p-5 ${item.read_at ? 'opacity-60' : ''}`} key={item.id}><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.read_at ? 'bg-white/20' : 'bg-brand'}`} /><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-sm text-content-secondary">{item.message}</p><p className="mt-2 text-xs text-content-muted">{new Date(item.created_at).toLocaleString()}</p></div></div>)}</Card> : <Card><Empty title="No notifications" /></Card> }
function Reports({ data }: { data: ReportData }) { return <div className="grid gap-5 lg:grid-cols-2"><Card className="overflow-hidden"><div className="border-b border-line p-5"><p className="font-semibold">Enquiries by source</p><p className="mt-1 text-xs text-content-secondary">Current CRM records grouped by source</p></div>{data.lead_sources.length ? <div className="divide-y divide-line">{data.lead_sources.map((item) => <div className="flex items-center justify-between px-5 py-3.5" key={item.source}><span className="text-sm">{item.source || 'Unspecified'}</span><span className="text-sm font-semibold">{item.count}</span></div>)}</div> : <Empty title="No enquiry data" />}</Card><Card className="overflow-hidden"><div className="border-b border-line p-5"><p className="font-semibold">Vendor performance</p><p className="mt-1 text-xs text-content-secondary">Ratings and on-time delivery from vendor records</p></div>{data.vendor_performance.length ? <div className="divide-y divide-line">{data.vendor_performance.map((item) => <div className="grid grid-cols-[1fr_auto_auto] items-center gap-5 px-5 py-3.5" key={item.name}><span className="truncate text-sm font-medium">{item.name}</span><span className="text-xs text-content-secondary">{item.rating.toFixed(1)} rating</span><span className="text-xs font-semibold">{item.on_time_rate}% on time</span></div>)}</div> : <Empty title="No vendor data" />}</Card><Card className="overflow-hidden lg:col-span-2"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5"><div><p className="font-semibold">Payment status</p><p className="mt-1 text-xs text-content-secondary">Counts and amounts from payment records</p></div><div className="flex gap-3"><Button onClick={() => window.print()}><FileText className="h-4 w-4" />Print / PDF</Button><Button variant="secondary" onClick={() => download('/reports/export.csv', 'atelier-flow-report.csv')}><Download className="h-4 w-4" />Export CSV</Button></div></div>{data.payment_statuses.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-white/[0.035] text-[11px] uppercase tracking-wider text-content-secondary"><tr><th className="px-5 py-3">Status</th><th>Records</th><th>Amount</th></tr></thead><tbody className="divide-y divide-line">{data.payment_statuses.map((item) => <tr key={item.status}><td className="px-5 py-3"><Badge value={item.status} /></td><td>{item.count}</td><td>{compactMoney(item.amount)}</td></tr>)}</tbody></table></div> : <Empty title="No payment data" />}</Card></div> }
function SettingsView({ items, onConfigure }: { items: SettingItem[]; onConfigure: (key: string, value: Record<string, unknown>) => void }) { const defaults = [['company_profile', 'Company profile', 'Branding, offices and tax identity'], ['users_roles', 'Users & roles', 'Access, permissions and client sign-ins'], ['project_stages', 'Project stages', 'Delivery workflow configuration'], ['quotation_templates', 'Quotation templates', 'Reusable scopes, taxes and terms'], ['notifications', 'Notifications', 'Channels, categories and schedules'], ['n8n', 'n8n automations', 'Webhook secrets and execution logs']]; return <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">{defaults.map(([key, title, text]) => { const saved = items.find((item) => item.key === key); return <Card variant="interactive" className="h-full p-5" key={key}><Settings className="h-5 w-5 text-brand-light" /><p className="mt-4 font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-content-secondary">{text}</p>{saved && <Badge value="approved" />}{key === 'users_roles' ? <Link to="/users" className="mt-5 block text-xs font-semibold text-brand-light hover:text-white">Manage client access →</Link> : <button onClick={() => onConfigure(key, saved?.value || {})} className="mt-5 block text-xs font-semibold text-brand">Configure →</button>}</Card> })}</div> }
