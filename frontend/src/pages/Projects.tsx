import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calendar, CircleDollarSign, MapPin, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, compactMoney, humanize } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Paginated, Project, Task } from '../lib/types'
import { Badge, Button, Card, ErrorState, Loading, PageHeader, Progress } from '../components/ui'

export function Projects() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', customer_id: '', location: '', start_date: '', expected_completion_date: '', contract_value: '', budget: '' })
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['projects'], queryFn: () => api<Paginated<Project>>('/projects') })
  const customers = useQuery({ queryKey: ['customers', 'project-options'], queryFn: () => api<Paginated<{ id: string; name: string }>>('/customers?page_size=100'), enabled: open })
  const create = useMutation({
    mutationFn: () => api<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        customer_id: form.customer_id || null,
        start_date: form.start_date || null,
        expected_completion_date: form.expected_completion_date || null,
        contract_value: Number(form.contract_value || 0),
        budget: Number(form.budget || 0),
      }),
    }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['projects'] })
      setOpen(false)
      setForm({ name: '', customer_id: '', location: '', start_date: '', expected_completion_date: '', contract_value: '', budget: '' })
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }
  return <>
    <PageHeader eyebrow="Delivery portfolio" title="Projects" description="Keep every stage, decision, deadline and commercial milestone visible." action={user?.role === 'admin' || user?.role === 'project_manager' ? <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New project</button> : undefined} />
    {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data?.items.map((project) => <Link to={`/projects/${project.id}`} key={project.id}><Card variant="interactive" className="h-full p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-content-muted">{project.code}</p><p className="mt-1 font-semibold">{project.name}</p></div><Badge value={project.health} /></div><p className="mt-3 flex items-center gap-1.5 text-xs text-content-secondary"><MapPin className="h-3.5 w-3.5" />{project.location}</p><div className="mt-6"><div className="mb-2 flex justify-between text-xs"><span className="text-content-secondary">{humanize(project.stage)}</span><span className="font-semibold">{project.progress}%</span></div><Progress value={project.progress} /></div><div className="mt-5 grid grid-cols-2 border-t border-line pt-4"><div><p className="text-[10px] uppercase tracking-wider text-content-muted">Contract value</p><p className="mt-1 text-sm font-semibold">{compactMoney(project.contract_value)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-content-muted">Expected finish</p><p className="mt-1 text-sm font-semibold">{project.expected_completion_date || '—'}</p></div></div></Card></Link>)}</div>}
    {open && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><button className="absolute inset-0" aria-label="Close" onClick={() => setOpen(false)} /><form className="surface relative w-full max-w-2xl p-6 sm:p-8" onSubmit={submit}><div className="flex justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-brand">New delivery</p><h2 className="mt-1 text-xl font-semibold">Create project</h2></div><button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close dialog"><X className="h-4 w-4" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="label">Project name</span><input className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label><span className="label">Customer</span><select className="input" value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })}><option value="">No customer selected</option>{customers.data?.items.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label><label><span className="label">Location</span><input className="input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label><span className="label">Start date</span><input className="input" type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></label><label><span className="label">Expected completion</span><input className="input" type="date" value={form.expected_completion_date} onChange={(event) => setForm({ ...form, expected_completion_date: event.target.value })} /></label><label><span className="label">Contract value</span><input className="input" min="0" type="number" value={form.contract_value} onChange={(event) => setForm({ ...form, contract_value: event.target.value })} /></label><label><span className="label">Internal budget</span><input className="input" min="0" type="number" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} /></label></div>{create.error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{create.error.message}</p>}<div className="mt-6 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create project'}</Button></div></form></div>}
  </>
}

interface Milestone { id: string; title: string; status: string; due_date: string; progress: number }
interface Design { id: string; title: string; room: string; stage: string; status: string }
interface Document { id: string; name: string; category: string; size_bytes: number }
interface ProjectDetailData { project: Project; milestones: Milestone[]; tasks: Task[]; designs: Design[]; documents: Document[] }

export function ProjectDetail() {
  const { id } = useParams()
  const query = useQuery({ queryKey: ['project', id], queryFn: () => api<ProjectDetailData>(`/projects/${id}`), enabled: Boolean(id) })
  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorState error={query.error} />
  if (!query.data) return null
  const { project, milestones, tasks, designs } = query.data
  return <>
    <Link to="/projects" className="mb-5 inline-flex items-center gap-2 text-sm text-content-secondary"><ArrowLeft className="h-4 w-4" />Back to projects</Link>
    <PageHeader eyebrow={project.code} title={project.name} description={`${humanize(project.stage)} · ${project.location}`} action={<Badge value={project.health} />} />
    <div className="mb-5 grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Progress" value={`${project.progress}%`} icon={Calendar} /><Metric label="Contract value" value={compactMoney(project.contract_value)} icon={CircleDollarSign} /><Metric label="Budget" value={compactMoney(project.budget)} icon={CircleDollarSign} /><Metric label="Due date" value={project.expected_completion_date || '—'} icon={Calendar} /></div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
      <div className="space-y-5"><Card className="p-5"><div className="flex justify-between text-sm"><span className="font-semibold">Overall delivery</span><span>{project.progress}%</span></div><div className="mt-3"><Progress value={project.progress} /></div></Card><Card className="overflow-hidden"><div className="border-b border-line p-5"><h2 className="font-semibold">Milestone timeline</h2></div><div className="p-5">{milestones.map((milestone, index) => <div className="relative flex gap-4 pb-8 last:pb-0" key={milestone.id}>{index < milestones.length - 1 && <span className="absolute left-3 top-7 h-[calc(100%-10px)] w-px bg-white/[0.09]" />}<span className={`relative mt-1 h-6 w-6 shrink-0 rounded-full border-[6px] ${milestone.status === 'completed' ? 'border-brand bg-panel' : 'border-line bg-panel'}`} /><div className="flex flex-1 items-start justify-between"><div><p className="text-sm font-semibold">{milestone.title}</p><p className="mt-1 text-xs text-content-secondary">Due {milestone.due_date}</p></div><Badge value={milestone.status} /></div></div>)}</div></Card><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line p-5"><h2 className="font-semibold">Project tasks</h2><Link to={`/projects/${id}/tasks`} className="text-xs font-semibold text-brand">Open board</Link></div><div className="divide-y divide-line">{tasks.slice(0, 6).map((task) => <div className="flex items-center justify-between p-4" key={task.id}><div><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-content-muted">Due {task.due_date || 'not set'}</p></div><Badge value={task.status} /></div>)}</div></Card></div>
      <div className="space-y-5"><Card className="p-5"><h2 className="font-semibold">Current stage</h2><p className="mt-3 text-xl font-semibold text-brand">{humanize(project.stage)}</p><p className="mt-2 text-sm leading-6 text-content-secondary">The team is coordinating current-stage deliverables and dependencies.</p></Card><Card className="p-5"><div className="flex justify-between"><h2 className="font-semibold">Designs</h2><Link className="text-xs font-semibold text-brand" to="/designs">View gallery</Link></div><div className="mt-4 space-y-3">{designs.map((design) => <div className="rounded-xl border border-line p-3" key={design.id}><div className="flex justify-between gap-2"><p className="text-sm font-semibold">{design.title}</p><Badge value={design.status} /></div><p className="mt-1 text-xs text-content-muted">{design.room} · {design.stage}</p></div>)}</div></Card></div>
    </div>
  </>
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Calendar }) {
  return <Card className="flex items-center gap-4 p-4"><span className="rounded-xl bg-subtle p-2.5"><Icon className="h-5 w-5 text-brand-light" /></span><div><p className="text-xs text-content-secondary">{label}</p><p className="mt-1 font-semibold">{value}</p></div></Card>
}
