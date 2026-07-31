import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, Clock3, Plus, User, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { api, humanize } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Paginated, Project, Task } from '../lib/types'
import { Badge, Button, Card, ErrorState, Loading, PageHeader } from '../components/ui'

const columns = ['to_do', 'in_progress', 'blocked', 'in_review', 'completed']

export function Tasks({ mine = false }: { mine?: boolean }) {
  const { user } = useAuth()
  const { id: routeProjectId } = useParams()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', project_id: routeProjectId || '', priority: 'medium', due_date: '', estimated_hours: '' })
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['tasks', mine], queryFn: () => api<Paginated<Task>>(`/tasks?page_size=100${mine ? '&mine=true' : ''}`) })
  const projects = useQuery({ queryKey: ['projects', 'task-options'], queryFn: () => api<Paginated<Project>>('/projects?page_size=100'), enabled: open })
  const create = useMutation({
    mutationFn: () => api<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        project_id: form.project_id || null,
        assignee_id: mine ? user?.id : null,
        due_date: form.due_date || null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      }),
    }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['tasks'] })
      setOpen(false)
      setForm({ title: '', description: '', project_id: routeProjectId || '', priority: 'medium', due_date: '', estimated_hours: '' })
    },
  })
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['tasks'] }),
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate()
  }
  return <>
    <PageHeader eyebrow={mine ? 'Personal workspace' : 'Delivery control'} title={mine ? 'My tasks' : 'Task board'} description={mine ? 'Your assignments, priorities and deadlines in one focused view.' : 'Coordinate work across disciplines, stages, projects and vendors.'} action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New task</Button>} />
    {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-4">{columns.map((status) => { const tasks = query.data?.items.filter((task) => task.status === status) || []; return <div className="w-[295px] shrink-0" key={status}><div className="mb-3 flex items-center justify-between px-1"><p className="text-sm font-semibold">{humanize(status)}</p><span className="rounded-full bg-white/[0.09] px-2 py-0.5 text-xs">{tasks.length}</span></div><div className="min-h-[480px] space-y-3 rounded-2xl bg-subtle/70 p-2">{tasks.map((task) => <Card className="p-4 shadow-sm" key={task.id}><div className="flex justify-between gap-3"><Badge value={task.priority} /><button aria-label="Complete task" onClick={() => update.mutate({ id: task.id, status: status === 'completed' ? 'to_do' : 'completed' })} className={`${status === 'completed' ? 'text-emerald-300' : 'text-white/30 hover:text-emerald-300'}`}><CheckCircle2 className="h-5 w-5" /></button></div><p className="mt-3 text-sm font-semibold leading-5">{task.title}</p><div className="mt-4 flex items-center justify-between text-xs text-content-muted"><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{task.due_date || 'No due date'}</span><span className="grid h-7 w-7 place-items-center rounded-full bg-subtle"><User className="h-3.5 w-3.5" /></span></div><select aria-label={`Status for ${task.title}`} className="mt-3 h-8 w-full rounded-lg border border-line bg-panel px-2 text-xs" value={task.status} onChange={(e) => update.mutate({ id: task.id, status: e.target.value })}>{columns.map((value) => <option value={value} key={value}>{humanize(value)}</option>)}</select></Card>)}{!tasks.length && <div className="flex h-32 flex-col items-center justify-center text-xs text-content-muted"><Clock3 className="mb-2 h-5 w-5" />No tasks</div>}</div></div> })}</div>}
    {open && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><button className="absolute inset-0" aria-label="Close" onClick={() => setOpen(false)} /><form onSubmit={submit} className="surface relative w-full max-w-xl p-6 sm:p-8"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-brand">New assignment</p><h2 className="mt-1 text-xl font-semibold">Create task</h2></div><button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close dialog"><X className="h-4 w-4" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="label">Task title</span><input className="input" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="sm:col-span-2"><span className="label">Description</span><textarea className="input h-20 py-3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label><span className="label">Project</span><select className="input" value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })}><option value="">Unassigned</option>{projects.data?.items.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><label><span className="label">Priority</span><select className="input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><label><span className="label">Due date</span><input className="input" type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></label><label><span className="label">Estimated hours</span><input className="input" type="number" min="0" value={form.estimated_hours} onChange={(event) => setForm({ ...form, estimated_hours: event.target.value })} /></label></div>{create.error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{create.error.message}</p>}<div className="mt-6 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create task'}</Button></div></form></div>}
  </>
}
