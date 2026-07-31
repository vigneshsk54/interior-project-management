import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, CheckCircle2, Clock3, Mail, MessageSquare, RefreshCw, UserRound } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Card, ErrorState, Loading, PageHeader } from '../components/ui'
import { api, humanize } from '../lib/api'

interface WorkActivity {
  id: string
  action: string
  title: string
  description: string
  entity_type: string
  entity_id?: string
  link?: string
  details?: Record<string, unknown>
  created_at: string
}

interface WorkProfileData {
  user: {
    id: string
    full_name: string
    email: string
    phone?: string
    role: string
  }
  summary: {
    total_actions: number
    enquiry_messages: number
    status_updates: number
    open_messages: number
  }
  messages: SharedMessage[]
  activities: WorkActivity[]
}

interface SharedMessage {
  id: string
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'completed'
  sender?: { id: string; full_name: string; role: string }
  client?: { id: string; full_name: string; email: string }
  updated_by?: { id: string; full_name: string }
  enquiry_id?: string
  project_id?: string
  created_at: string
  updated_at: string
  completed_at?: string
}

export function WorkProfile() {
  const client = useQueryClient()
  const [params] = useSearchParams()
  const highlightedMessage = params.get('message')
  const query = useQuery({
    queryKey: ['work-profile'],
    queryFn: () => api<WorkProfileData>('/profile/activity'),
    refetchInterval: 5000,
  })
  const updateMessage = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SharedMessage['status'] }) => api(`/communications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['work-profile'] })
      client.invalidateQueries({ queryKey: ['notifications'] })
      client.invalidateQueries({ queryKey: ['portal-notifications'] })
    },
  })
  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorState error={query.error} />
  if (!query.data) return null
  const { user, summary, messages, activities } = query.data
  const initials = user.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('')
  return <>
    <PageHeader eyebrow="Personal work record" title="My activity" description="Every enquiry message, status update, and operational change completed by you." />
    <Card className="mb-5 p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-light text-lg font-bold text-white">{initials}</span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{user.full_name}</h2><Badge value={user.role} /></div><p className="mt-2 flex items-center gap-2 text-sm text-content-secondary"><Mail className="h-4 w-4 text-brand-light" />{user.email}</p>{user.phone && <p className="mt-2 text-sm text-content-muted">{user.phone}</p>}</div>
      </div>
    </Card>
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Activity} label="Recorded actions" value={summary.total_actions} />
      <Metric icon={MessageSquare} label="Enquiry messages" value={summary.enquiry_messages} />
      <Metric icon={RefreshCw} label="Enquiry updates" value={summary.status_updates} />
      <Metric icon={CheckCircle2} label="Open messages" value={summary.open_messages} />
    </div>
    <Card className="mb-5 overflow-hidden">
      <div className="border-b border-line p-5 sm:px-6"><h2 className="font-semibold">Shared client messages</h2><p className="mt-1 text-xs text-content-secondary">Both the client and studio can view these messages and update their completion status.</p></div>
      {messages.length ? <div className="divide-y divide-line">{messages.map((item) => <article id={`message-${item.id}`} className={`p-5 transition sm:px-6 ${highlightedMessage === item.id ? 'bg-brand/10 ring-1 ring-inset ring-brand/30' : ''}`} key={item.id}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.subject}</p><Badge value={item.status} /></div><p className="mt-2 text-xs text-content-muted">{item.sender?.full_name || 'Unknown sender'} → {item.sender?.role === 'client' ? 'Studio team' : item.client?.full_name || 'Client'}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-content-secondary">{item.message}</p><p className="mt-3 text-xs text-content-muted">Sent {new Date(item.created_at).toLocaleString()}{item.updated_by ? ` · Last updated by ${item.updated_by.full_name}` : ''}</p></div>
          <label className="w-full shrink-0 sm:w-44"><span className="label">Completion status</span><select aria-label={`Completion status for ${item.subject}`} className="input" value={item.status} disabled={updateMessage.isPending} onChange={(event) => updateMessage.mutate({ id: item.id, status: event.target.value as SharedMessage['status'] })}><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
        </div>
      </article>)}</div> : <div className="grid min-h-44 place-items-center p-8 text-center"><div><MessageSquare className="mx-auto h-7 w-7 text-brand-light" /><p className="mt-3 font-semibold">No shared messages yet</p><p className="mt-2 text-sm text-content-secondary">Client and studio messages will appear here automatically.</p></div></div>}
    </Card>
    <Card className="overflow-hidden">
      <div className="border-b border-line p-5 sm:px-6"><h2 className="font-semibold">Work history</h2><p className="mt-1 text-xs text-content-secondary">This profile contains actions performed using your signed-in account.</p></div>
      {activities.length ? <div className="divide-y divide-line">{activities.map((item) => {
        const content = <div className="flex gap-4 p-5 sm:px-6"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10"><Activity className="h-4 w-4 text-brand-light" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-content-secondary">{item.description}</p></div><Badge value={item.action} /></div><p className="mt-3 flex items-center gap-1.5 text-xs text-content-muted"><Clock3 className="h-3.5 w-3.5" />{new Date(item.created_at).toLocaleString()} · {humanize(item.entity_type)}</p></div></div>
        return item.link ? <Link className="block transition hover:bg-white/[0.035]" to={item.link} key={item.id}>{content}</Link> : <div key={item.id}>{content}</div>
      })}</div> : <div className="grid min-h-56 place-items-center p-8 text-center"><div><UserRound className="mx-auto h-8 w-8 text-brand-light" /><p className="mt-4 font-semibold">No recorded work yet</p><p className="mt-2 text-sm text-content-secondary">Messages and updates you complete will appear here automatically.</p></div></div>}
    </Card>
  </>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return <Card className="flex items-center gap-4 p-5"><span className="rounded-xl bg-subtle p-3"><Icon className="h-5 w-5 text-brand-light" /></span><div><p className="text-xs text-content-secondary">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div></Card>
}
