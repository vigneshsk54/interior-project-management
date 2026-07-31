import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowLeft, Bell, CalendarDays, CheckCircle2, ClipboardList, FileText, Home, LogOut, MapPin, MessageCircle, PackageCheck, Palette, Plus, Send, Truck, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { api, compactMoney, humanize } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Enquiry, Project } from '../lib/types'
import { Badge, Button, Card, ErrorState, Loading, Progress } from '../components/ui'
import { WorkProfile } from './WorkProfile'

interface ClientPortalData {
  customer?: { name: string }
  enquiries: Enquiry[]
  projects: Project[]
  approvals: { id: string; entity_type: string; status: string }[]
  notifications: { id: string; title: string; message: string }[]
}

interface PortalNotification {
  id: string
  title: string
  message: string
  link?: string
  read_at?: string
}

const projectRequestSchema = z.object({
  title: z.string().trim().min(3, 'Enter a project name'),
  propertyType: z.string().min(2, 'Select a property type'),
  location: z.string().trim().min(2, 'Enter the project location'),
  areaSqft: z.string().refine((value) => !value || Number(value) > 0, 'Enter a valid area'),
  budgetMin: z.string().refine((value) => !value || Number(value) >= 0, 'Enter a valid budget'),
  budgetMax: z.string().refine((value) => !value || Number(value) >= 0, 'Enter a valid budget'),
  expectedStartDate: z.string(),
  requirements: z.string().trim().min(10, 'Tell us a little more about your project'),
}).refine(
  (values) => !values.budgetMin || !values.budgetMax || Number(values.budgetMin) <= Number(values.budgetMax),
  { message: 'Maximum budget must be greater than minimum budget', path: ['budgetMax'] },
)
type ProjectRequestForm = z.infer<typeof projectRequestSchema>

function PortalHeader({ title }: { title: string }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const notifications = useQuery({
    queryKey: ['portal-notifications', user?.id],
    queryFn: () => api<PortalNotification[]>('/notifications/list'),
    enabled: Boolean(user),
    refetchInterval: 5000,
  })
  const openNotification = async (item: PortalNotification) => {
    if (!item.read_at) await api(`/notifications/${item.id}/read`, { method: 'POST' })
    setOpen(false)
    notifications.refetch()
    if (item.link) navigate(item.link)
  }
  return <header className="sticky top-0 z-30 border-b border-line bg-app/90 backdrop-blur-xl"><div className="relative mx-auto flex h-[72px] max-w-6xl items-center px-4 sm:px-6"><Link to="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-xs font-bold text-white">AF</span><div><p className="font-semibold">Atelier Flow</p><p className="text-[10px] uppercase tracking-widest text-content-muted">{title}</p></div></Link><div className="ml-auto flex items-center gap-3">{user?.role === 'client' && <Link aria-label="My activity" title="My activity" className="icon-btn" to="/client-activity"><Activity className="h-4 w-4 text-content-secondary" /></Link>}<button type="button" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen(!open)} className="icon-btn relative">{notifications.data?.some((item) => !item.read_at) && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-panel bg-brand" />}<Bell className="h-4 w-4 text-content-secondary" /></button><span className="hidden text-sm font-medium sm:block">{user?.full_name}</span><button aria-label="Sign out" onClick={logout} className="icon-btn"><LogOut className="h-4 w-4" /></button></div>{open && <div className="absolute right-4 top-16 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-line bg-panel shadow-elevated sm:right-6"><div className="border-b border-line p-4"><p className="font-semibold">Notifications</p></div><div className="max-h-80 overflow-y-auto">{notifications.data?.length ? notifications.data.map((item) => <button type="button" onClick={() => openNotification(item)} className="block w-full border-b border-line p-4 text-left last:border-0 hover:bg-white/[0.05]" key={item.id}><div className="flex gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? 'bg-white/15' : 'bg-brand'}`} /><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-content-secondary">{item.message}</p></div></div></button>) : <p className="p-7 text-center text-sm text-content-secondary">No notifications yet.</p>}</div></div>}</div></header>
}

export function ClientPortal() {
  const client = useQueryClient()
  const [requestOpen, setRequestOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const query = useQuery({
    queryKey: ['client-portal'],
    queryFn: () => api<ClientPortalData>('/portal/client'),
    refetchInterval: 5000,
  })
  const form = useForm<ProjectRequestForm>({
    resolver: zodResolver(projectRequestSchema),
    defaultValues: {
      title: '',
      propertyType: '',
      location: '',
      areaSqft: '',
      budgetMin: '',
      budgetMax: '',
      expectedStartDate: '',
      requirements: '',
    },
  })
  const contactForm = useForm<{ subject: string; message: string }>({
    defaultValues: { subject: '', message: '' },
  })
  const createRequest = useMutation({
    mutationFn: (values: ProjectRequestForm) => api<Enquiry>('/portal/client/enquiries', {
      method: 'POST',
      body: JSON.stringify({
        title: values.title,
        property_type: values.propertyType,
        location: values.location,
        area_sqft: values.areaSqft ? Number(values.areaSqft) : undefined,
        budget_min: values.budgetMin ? Number(values.budgetMin) : undefined,
        budget_max: values.budgetMax ? Number(values.budgetMax) : undefined,
        expected_start_date: values.expectedStartDate || undefined,
        requirements: values.requirements,
      }),
    }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['client-portal'] })
      form.reset()
      setRequestOpen(false)
    },
  })
  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/approvals/${id}/decision`, { method: 'POST', body: JSON.stringify({ status, comment: status === 'approved' ? 'Approved in client portal' : 'Revision requested in client portal' }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['client-portal'] }),
  })
  const sendMessage = useMutation({
    mutationFn: (values: { subject: string; message: string }) => api('/portal/client/messages', {
      method: 'POST',
      body: JSON.stringify(values),
    }),
    onSuccess: () => {
      contactForm.reset()
      setContactOpen(false)
    },
  })
  const hasWork = Boolean(query.data?.projects?.length || query.data?.enquiries?.length)

  return <div className="min-h-screen bg-app">
    <PortalHeader title="Client portal" />
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : <>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-light">Your projects</p>
            <h1 className="mt-2 text-3xl font-semibold">Welcome, {query.data?.customer?.name?.split(' ')[0] || 'there'}</h1>
            <p className="mt-2 text-sm text-content-secondary">Follow progress, review designs and keep decisions moving.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setContactOpen(true)}><MessageCircle className="h-4 w-4" />Contact studio</Button>
            {hasWork && <Button onClick={() => setRequestOpen(true)}><Plus className="h-4 w-4" />Start another project</Button>}
          </div>
        </div>

        {!hasWork ? <Card className="mt-8 overflow-hidden">
          <div className="grid min-h-[360px] place-items-center bg-[radial-gradient(circle_at_top,rgba(124,92,255,.14),transparent_58%)] p-8 text-center">
            <div>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-brand/25 bg-brand/10"><Home className="h-7 w-7 text-brand-light" /></span>
              <h2 className="mt-6 text-2xl font-semibold">Let’s plan your first space</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-content-secondary">Tell us about your property, location and goals. Your request will go directly to the studio, and its progress will appear here.</p>
              <Button className="mt-6" onClick={() => setRequestOpen(true)}><Plus className="h-4 w-4" />Start a project</Button>
            </div>
          </div>
        </Card> : <div className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
          <div className="space-y-6">
            {Boolean(query.data?.projects.length) && <section>
              <h2 className="mb-3 text-sm font-semibold text-content-secondary">Active projects</h2>
              <div className="space-y-4">{query.data?.projects.map((project) => <Link className="block" to={`/client-projects/${project.id}`} key={project.id}><Card variant="interactive" className="p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-content-muted">{project.code}</p><p className="mt-1 text-lg font-semibold">{project.name}</p><p className="mt-1 text-sm text-content-secondary">{project.location}</p></div><Badge value={project.health} /></div><div className="mt-7"><div className="mb-2 flex justify-between text-sm"><span>{humanize(project.stage)}</span><strong>{project.progress}%</strong></div><Progress value={project.progress} /></div><div className="mt-6 grid grid-cols-2 border-t border-line pt-4 text-sm"><div><p className="text-xs text-content-muted">Current status</p><p className="mt-1 font-semibold">{humanize(project.status)}</p></div><div><p className="text-xs text-content-muted">Expected completion</p><p className="mt-1 font-semibold">{project.expected_completion_date || '—'}</p></div></div></Card></Link>)}</div>
            </section>}
            {Boolean(query.data?.enquiries?.length) && <section>
              <h2 className="mb-3 text-sm font-semibold text-content-secondary">Project requests</h2>
              <div className="space-y-3">{query.data?.enquiries?.map((enquiry) => <Link className="block" to={`/client-enquiries/${enquiry.id}`} key={enquiry.id}><Card variant="interactive" className="p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10"><ClipboardList className="h-5 w-5 text-brand-light" /></span><div><p className="font-semibold">{enquiry.title}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-content-secondary"><MapPin className="h-3.5 w-3.5" />{enquiry.location} · {enquiry.property_type}</p><p className="mt-2 text-xs text-content-muted">Your enquiry no. <strong className="text-content-secondary">{enquiry.client_reference}</strong> · Submitted {new Date(enquiry.created_at).toLocaleDateString('en-IN')}</p><p className="mt-3 text-xs font-semibold text-brand-light">View enquiry and messages →</p></div></div><Badge value={enquiry.status} /></div></Card></Link>)}</div>
            </section>}
          </div>
          <div className="space-y-5">
            <Card className="p-5"><p className="font-semibold">Waiting for you</p><div className="mt-4 space-y-3">{query.data?.approvals.length ? query.data.approvals.map((approval) => <div className="rounded-xl bg-subtle p-3" key={approval.id}><div className="flex items-center gap-3"><Palette className="h-5 w-5 text-brand-light" /><div className="flex-1"><p className="text-sm font-semibold">{humanize(approval.entity_type)} review</p><p className="text-xs text-content-secondary">Approval requested</p></div></div><div className="mt-3 flex gap-2"><button disabled={decide.isPending} onClick={() => decide.mutate({ id: approval.id, status: 'approved' })} className="btn-primary h-8 flex-1 text-xs">Approve</button><button disabled={decide.isPending} onClick={() => decide.mutate({ id: approval.id, status: 'revision_requested' })} className="btn-secondary h-8 flex-1 text-xs">Request revision</button></div></div>) : <div className="py-5 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-300" /><p className="mt-2 text-sm text-content-secondary">No pending decisions</p></div>}</div></Card>
            <Card className="p-5"><p className="font-semibold">Recent updates</p><div className="mt-4 space-y-4">{query.data?.notifications.length ? query.data.notifications.map((item) => <div className="flex gap-3" key={item.id}><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" /><div><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs leading-5 text-content-secondary">{item.message}</p></div></div>) : <p className="py-4 text-center text-sm text-content-muted">Updates from the studio will appear here.</p>}</div></Card>
          </div>
        </div>}
      </>}
    </main>

    {requestOpen && <div className="fixed inset-0 z-[80] flex justify-end bg-black/65 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="project-request-title">
      <button aria-label="Close project request" className="absolute inset-0" onClick={() => setRequestOpen(false)} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-6 shadow-elevated sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand-light">New project</p><h2 id="project-request-title" className="mt-1 text-2xl font-semibold">Tell us about your space</h2><p className="mt-2 text-sm text-content-secondary">Share the essentials and the studio will contact you with next steps.</p></div><Button aria-label="Close dialog" variant="icon" onClick={() => setRequestOpen(false)}><X className="h-4 w-4" /></Button></div>
        <form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={form.handleSubmit((values) => createRequest.mutate(values))}>
          <PortalField className="sm:col-span-2" label="Project name" error={form.formState.errors.title?.message}><input className="input" placeholder="e.g. Apartment renovation" {...form.register('title')} /></PortalField>
          <PortalField label="Property type" error={form.formState.errors.propertyType?.message}><select className="input" {...form.register('propertyType')}><option value="">Select</option><option>Apartment</option><option>Villa</option><option>Office</option><option>Retail</option></select></PortalField>
          <PortalField label="Area (sq ft)" error={form.formState.errors.areaSqft?.message}><input className="input" min="1" type="number" {...form.register('areaSqft')} /></PortalField>
          <PortalField className="sm:col-span-2" label="Location" error={form.formState.errors.location?.message}><input className="input" placeholder="Area, city" {...form.register('location')} /></PortalField>
          <PortalField label="Budget from"><input className="input" min="0" type="number" {...form.register('budgetMin')} /></PortalField>
          <PortalField label="Budget to" error={form.formState.errors.budgetMax?.message}><input className="input" min="0" type="number" {...form.register('budgetMax')} /></PortalField>
          <PortalField label="Expected start date"><input className="input" type="date" {...form.register('expectedStartDate')} /></PortalField>
          <PortalField className="sm:col-span-2" label="What would you like to create?" error={form.formState.errors.requirements?.message}><textarea className="input min-h-28 py-3" placeholder="Rooms, style, priorities and anything else we should know…" {...form.register('requirements')} /></PortalField>
          {createRequest.error && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300 sm:col-span-2">{createRequest.error.message}</p>}
          <div className="flex justify-end gap-3 border-t border-line pt-5 sm:col-span-2"><Button variant="secondary" onClick={() => setRequestOpen(false)}>Cancel</Button><Button type="submit" disabled={createRequest.isPending}>{createRequest.isPending ? 'Submitting…' : 'Submit project request'}</Button></div>
        </form>
      </aside>
    </div>}
    {contactOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="contact-studio-title">
      <button aria-label="Close contact form" className="absolute inset-0" onClick={() => setContactOpen(false)} />
      <form className="surface relative w-full max-w-lg p-6 sm:p-8" onSubmit={contactForm.handleSubmit((values) => sendMessage.mutate(values))}>
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand-light">Client support</p><h2 id="contact-studio-title" className="mt-1 text-2xl font-semibold">Contact the studio</h2><p className="mt-2 text-sm leading-6 text-content-secondary">Your message will be delivered to the administrators with your client profile.</p></div><Button aria-label="Close dialog" variant="icon" onClick={() => setContactOpen(false)}><X className="h-4 w-4" /></Button></div>
        <div className="mt-7 space-y-5">
          <label><span className="label">Subject</span><input className="input" minLength={3} required {...contactForm.register('subject')} /></label>
          <label><span className="label">Message</span><textarea className="input min-h-32 py-3" minLength={10} required {...contactForm.register('message')} /></label>
        </div>
        {sendMessage.error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{sendMessage.error.message}</p>}
        <div className="mt-6 flex justify-end gap-3 border-t border-line pt-5"><Button variant="secondary" onClick={() => setContactOpen(false)}>Cancel</Button><Button type="submit" disabled={sendMessage.isPending}>{sendMessage.isPending ? 'Sending…' : 'Send message'}</Button></div>
      </form>
    </div>}
  </div>
}

interface EnquiryConversationActivity {
  id: string
  activity_type: 'client_message' | 'team_message'
  message: string
  created_at: string
  metadata_json?: { sender_name?: string; sender_role?: string }
}

interface ClientEnquiryData {
  enquiry: Enquiry
  messages: EnquiryConversationActivity[]
}

export function ClientEnquiryConversation() {
  const { id } = useParams()
  const client = useQueryClient()
  const [message, setMessage] = useState('')
  const query = useQuery({
    queryKey: ['client-enquiry', id],
    queryFn: () => api<ClientEnquiryData>(`/portal/client/enquiries/${id}`),
    enabled: Boolean(id),
    refetchInterval: 5000,
  })
  const send = useMutation({
    mutationFn: () => api(`/portal/client/enquiries/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
    onSuccess: () => {
      setMessage('')
      client.invalidateQueries({ queryKey: ['client-enquiry', id] })
      client.invalidateQueries({ queryKey: ['client-portal'] })
    },
  })
  return <div className="min-h-screen bg-app">
    <PortalHeader title="Client portal" />
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : query.data && <>
        <Link to="/client-portal" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-white"><ArrowLeft className="h-4 w-4" />Back to client portal</Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand-light">Your enquiry no. · {query.data.enquiry.client_reference}</p><h1 className="mt-2 text-3xl font-semibold">{query.data.enquiry.title}</h1><p className="mt-2 text-sm text-content-secondary">{query.data.enquiry.property_type} · {query.data.enquiry.location}</p></div><Badge value={query.data.enquiry.status} /></div>
        <Card className="mt-8 overflow-hidden">
          <div className="border-b border-line p-5 sm:px-6"><h2 className="font-semibold">Enquiry conversation</h2><p className="mt-1 text-xs text-content-secondary">Questions from the studio appear here and are visible only to you and the studio team.</p></div>
          <div className="min-h-64 space-y-4 p-5 sm:p-6">
            {query.data.messages.length ? query.data.messages.map((item) => {
              const mine = item.activity_type === 'client_message'
              return <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`} key={item.id}><div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? 'bg-brand text-white' : 'border border-line bg-subtle'}`}><p className={`text-[11px] font-semibold ${mine ? 'text-white/75' : 'text-brand-light'}`}>{mine ? 'You' : item.metadata_json?.sender_name || 'Studio team'}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.message}</p><p className={`mt-2 text-[10px] ${mine ? 'text-white/65' : 'text-content-muted'}`}>{new Date(item.created_at).toLocaleString()}</p></div></div>
            }) : <div className="grid min-h-48 place-items-center text-center"><div><MessageCircle className="mx-auto h-7 w-7 text-brand-light" /><p className="mt-3 text-sm text-content-secondary">No questions yet. You can send additional information below.</p></div></div>}
          </div>
          <form className="border-t border-line p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); if (message.trim().length >= 3) send.mutate() }}>
            <label><span className="label">Reply about this enquiry</span><textarea className="input min-h-24 py-3" value={message} onChange={(event) => setMessage(event.target.value)} minLength={3} maxLength={3000} required placeholder="Add details or answer the studio’s question…" /></label>
            {send.error && <p role="alert" className="mt-3 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{send.error.message}</p>}
            <div className="mt-4 flex justify-end"><Button type="submit" disabled={send.isPending || message.trim().length < 3}><Send className="h-4 w-4" />{send.isPending ? 'Sending…' : 'Send reply'}</Button></div>
          </form>
        </Card>
      </>}
    </main>
  </div>
}

export function ClientActivity() {
  return <div className="min-h-screen bg-app">
    <PortalHeader title="Client portal" />
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/client-portal" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-white"><ArrowLeft className="h-4 w-4" />Back to client portal</Link>
      <WorkProfile />
    </main>
  </div>
}

interface ClientProjectProgressData {
  project: {
    id: string
    code: string
    name: string
    status: string
    stage: string
    health: string
    progress: number
    location: string
    start_date?: string
    expected_completion_date?: string
  }
  milestones: { id: string; title: string; status: string; due_date: string; progress: number }[]
  designs: { id: string; title: string; room: string; stage: string; status: string }[]
}

export function ClientProjectProgress() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: ['client-project-progress', id],
    queryFn: () => api<ClientProjectProgressData>(`/portal/client/projects/${id}`),
    enabled: Boolean(id),
  })
  return <div className="min-h-screen bg-app">
    <PortalHeader title="Client portal" />
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : query.data && <>
        <Link to="/client-portal" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-white"><ArrowLeft className="h-4 w-4" />Back to client portal</Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand-light">{query.data.project.code}</p><h1 className="mt-2 text-3xl font-semibold">{query.data.project.name}</h1><p className="mt-2 flex items-center gap-1.5 text-sm text-content-secondary"><MapPin className="h-4 w-4" />{query.data.project.location}</p></div><Badge value={query.data.project.health} /></div>
        <Card className="mt-8 overflow-hidden"><div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex items-center justify-between text-sm"><span className="font-semibold">Overall work completed</span><strong className="text-2xl text-brand-light">{query.data.project.progress}%</strong></div><div className="mt-4"><Progress value={query.data.project.progress} /></div><p className="mt-3 text-sm text-content-secondary">Current stage: <span className="font-semibold text-white">{humanize(query.data.project.stage)}</span></p></div><div className="grid grid-cols-2 gap-4 border-line lg:border-l lg:pl-8"><div><p className="text-xs text-content-muted">Status</p><p className="mt-1 font-semibold">{humanize(query.data.project.status)}</p></div><div><p className="text-xs text-content-muted">Expected completion</p><p className="mt-1 font-semibold">{query.data.project.expected_completion_date || 'To be confirmed'}</p></div></div></div></Card>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <Card className="overflow-hidden"><div className="border-b border-line p-5 sm:px-6"><h2 className="font-semibold">Project milestones</h2><p className="mt-1 text-xs text-content-secondary">The delivery stages shared by your project team.</p></div><div className="divide-y divide-line">{query.data.milestones.map((milestone) => <div className="p-5 sm:px-6" key={milestone.id}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">{milestone.title}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-content-muted"><CalendarDays className="h-3.5 w-3.5" />Due {milestone.due_date}</p></div><Badge value={milestone.status} /></div><div className="mt-3 flex items-center gap-3"><Progress value={milestone.progress} /><span className="text-xs font-semibold">{milestone.progress}%</span></div></div>)}</div></Card>
          <div className="space-y-5"><Card className="p-5"><h2 className="font-semibold">Shared designs</h2><div className="mt-4 space-y-3">{query.data.designs.length ? query.data.designs.map((design) => <div className="rounded-xl border border-line p-3" key={design.id}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{design.title}</p><p className="mt-1 text-xs text-content-muted">{design.room} · {design.stage}</p></div><Badge value={design.status} /></div></div>) : <p className="py-4 text-center text-sm text-content-muted">No designs shared yet.</p>}</div></Card><Card className="p-5"><MessageCircle className="h-5 w-5 text-brand-light" /><h2 className="mt-4 font-semibold">Need an update?</h2><p className="mt-2 text-sm leading-6 text-content-secondary">Return to the client portal and use Contact studio. Your message goes directly to the administrators.</p><Link className="btn-secondary mt-4 w-full" to="/client-portal">Contact studio</Link></Card></div>
        </div>
      </>}
    </main>
  </div>
}

function PortalField({ label, error, className = '', children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return <label className={className}><span className="label">{label}</span>{children}{error && <span className="mt-1 block text-xs text-red-300">{error}</span>}</label>
}

interface VendorPortalData { vendor?: { name: string; rating: number; on_time_rate: number }; work_orders: { id: string; reference: string; title: string; status: string; due_date?: string; amount?: number }[] }
export function VendorPortal() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['vendor-portal'], queryFn: () => api<VendorPortalData>('/portal/vendor') })
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api(`/portal/vendor/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['vendor-portal'] }),
  })
  return <div className="min-h-screen bg-app"><PortalHeader title="Vendor portal" /><main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">{query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : <><p className="text-xs font-bold uppercase tracking-[.16em] text-brand-light">Partner workspace</p><h1 className="mt-2 text-3xl font-semibold">{query.data?.vendor?.name}</h1><p className="mt-2 text-sm text-content-secondary">Manage assigned orders, delivery commitments and invoices.</p><div className="mt-8 grid gap-4 sm:grid-cols-3"><PortalMetric icon={PackageCheck} label="Open work orders" value={String(query.data?.work_orders.length || 0)} /><PortalMetric icon={Truck} label="On-time performance" value={`${query.data?.vendor?.on_time_rate || 0}%`} /><PortalMetric icon={FileText} label="Quality rating" value={`${query.data?.vendor?.rating || 0} / 5`} /></div><Card className="mt-5 overflow-hidden"><div className="border-b border-line p-5"><p className="font-semibold">Assigned work</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-white/[0.035] text-xs text-content-secondary"><tr><th className="px-5 py-3">Reference</th><th>Work order</th><th>Due date</th><th>Value</th><th>Status</th></tr></thead><tbody>{query.data?.work_orders.map((order) => <tr className="border-t border-line" key={order.id}><td className="px-5 py-4">{order.reference}</td><td className="font-semibold">{order.title}</td><td>{order.due_date || '—'}</td><td>{order.amount ? compactMoney(order.amount) : '—'}</td><td><select className="h-9 rounded-lg border border-line bg-panel px-2 text-xs" value={order.status} onChange={(event) => update.mutate({ id: order.id, status: event.target.value })}><option>pending</option><option>accepted</option><option>in_progress</option><option>dispatched</option><option>delivered</option><option>completed</option></select></td></tr>)}</tbody></table></div></Card></>}</main></div>
}
function PortalMetric({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string }) { return <Card className="flex items-center gap-4 p-5"><span className="rounded-xl bg-subtle p-3"><Icon className="h-5 w-5 text-brand-light" /></span><div><p className="text-xs text-content-secondary">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div></Card> }
