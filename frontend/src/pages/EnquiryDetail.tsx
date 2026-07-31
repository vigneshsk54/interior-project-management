import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarPlus, Edit3, FilePlus2, Mail, MapPin, MessageSquare, Phone, Send, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, compactMoney, humanize } from '../lib/api'
import { useAuth } from '../lib/auth'
import { normalizeEmailCase } from '../lib/validation'
import type { Enquiry, Quotation } from '../lib/types'
import { Badge, Button, Card, ErrorState, Loading, PageHeader } from '../components/ui'

interface Activity {
  id: string
  activity_type: string
  message: string
  created_at: string
  metadata_json?: { sender_name?: string; sender_role?: string }
}
interface Detail { enquiry: Enquiry; activities: Activity[]; quotations: Quotation[] }
interface EnquiryEditForm {
  title: string
  contact_name: string
  email: string
  phone: string
  property_type: string
  location: string
  area_sqft: string
  budget_min: string
  budget_max: string
  expected_start_date: string
  requirements: string
  source: string
  status: string
}

const enquiryStatuses = ['new','contacted','site_visit_scheduled','requirement_collected','quotation_sent','negotiation','won','lost']

export function EnquiryDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const client = useQueryClient()
  const [question, setQuestion] = useState('')
  const [editForm, setEditForm] = useState<EnquiryEditForm | null>(null)
  const canFullyEdit = user?.role === 'admin'
  const canManageCommercial = user?.role === 'admin' || user?.role === 'sales_manager'
  const canUpdateStatus = Boolean(user && !['client', 'vendor'].includes(user.role))
  const query = useQuery({
    queryKey: ['enquiry', id],
    queryFn: () => api<Detail>(`/enquiries/${id}`),
    enabled: Boolean(id),
    refetchInterval: 5000,
  })
  const update = useMutation({
    mutationFn: (status: string) => api<Enquiry>(`/enquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['enquiry', id] }),
  })
  const sendQuestion = useMutation({
    mutationFn: () => api(`/enquiries/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: question }),
    }),
    onSuccess: () => {
      setQuestion('')
      client.invalidateQueries({ queryKey: ['enquiry', id] })
      client.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const saveEdit = useMutation({
    mutationFn: (values: EnquiryEditForm) => api<Enquiry>(`/enquiries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...values,
        area_sqft: values.area_sqft ? Number(values.area_sqft) : null,
        budget_min: values.budget_min ? Number(values.budget_min) : null,
        budget_max: values.budget_max ? Number(values.budget_max) : null,
        expected_start_date: values.expected_start_date || null,
      }),
    }),
    onSuccess: () => {
      setEditForm(null)
      client.invalidateQueries({ queryKey: ['enquiry', id] })
      client.invalidateQueries({ queryKey: ['enquiries'] })
    },
  })
  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorState error={query.error} />
  if (!query.data) return null
  const { enquiry, activities, quotations } = query.data
  const openEdit = () => {
    saveEdit.reset()
    setEditForm({
      title: enquiry.title,
      contact_name: enquiry.contact_name,
      email: enquiry.email,
      phone: enquiry.phone,
      property_type: enquiry.property_type,
      location: enquiry.location,
      area_sqft: enquiry.area_sqft ? String(enquiry.area_sqft) : '',
      budget_min: enquiry.budget_min ? String(enquiry.budget_min) : '',
      budget_max: enquiry.budget_max ? String(enquiry.budget_max) : '',
      expected_start_date: enquiry.expected_start_date || '',
      requirements: enquiry.requirements || '',
      source: enquiry.source,
      status: enquiry.status,
    })
  }
  return <>
    <Link to="/enquiries" className="mb-5 inline-flex items-center gap-2 text-sm text-content-secondary hover:text-content"><ArrowLeft className="h-4 w-4" />Back to enquiries</Link>
    <PageHeader eyebrow={`Studio enquiry · ${enquiry.reference}`} title={enquiry.title} description={`${enquiry.property_type} · ${enquiry.location}`} action={canFullyEdit || canManageCommercial ? <div className="flex flex-wrap gap-2">{canFullyEdit && <Button variant="secondary" onClick={openEdit}><Edit3 className="h-4 w-4" />Edit enquiry</Button>}{canManageCommercial && <><Link className="btn-secondary" to={`/site-visits/new?enquiry=${enquiry.id}`}><CalendarPlus className="h-4 w-4" />Site visit</Link><Link className="btn-primary" to={`/quotations/new?enquiry=${enquiry.id}`}><FilePlus2 className="h-4 w-4" />Create quote</Link></>}</div> : undefined} />
    <div className="grid gap-5 xl:grid-cols-[1.5fr_.8fr]">
      <div className="space-y-5">
        <Card className="p-5"><div className="grid gap-4 border-b border-line pb-4 sm:grid-cols-2"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Studio enquiry number</p><p className="mt-1 text-sm font-semibold">{enquiry.reference}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">{enquiry.contact_name}&apos;s enquiry number</p><p className="mt-1 text-sm font-semibold">{enquiry.client_reference}</p></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-content-muted">Pipeline status</p><div className="mt-2"><Badge value={enquiry.status} /></div><p className="mt-2 text-xs text-content-muted">{canFullyEdit ? 'You can edit all enquiry details.' : 'Enquiry details are view-only; you can update work status.'}</p></div>{canUpdateStatus && <select aria-label="Update enquiry status" className="input w-56" value={enquiry.status} onChange={(e) => update.mutate(e.target.value)}>{enquiryStatuses.map((value) => <option value={value} key={value}>{humanize(value)}</option>)}</select>}</div></Card>
        <Card className="p-5"><h2 className="font-semibold">Project brief</h2><div className="mt-5 grid gap-5 sm:grid-cols-3"><Info label="Approximate area" value={enquiry.area_sqft ? `${enquiry.area_sqft.toLocaleString()} sq ft` : 'Not provided'} /><Info label="Budget range" value={enquiry.budget_min ? `${compactMoney(enquiry.budget_min)}–${compactMoney(enquiry.budget_max || enquiry.budget_min)}` : 'Not provided'} /><Info label="Expected start" value={enquiry.expected_start_date || 'Flexible'} /></div><div className="mt-6 border-t border-line pt-5"><p className="label">Requirements</p><p className="text-sm leading-6 text-content-secondary">{enquiry.requirements || 'No requirements captured yet.'}</p></div></Card>
        <Card className="overflow-hidden"><div className="border-b border-line p-5"><h2 className="font-semibold">Activity and conversation</h2></div><div className="p-5">{activities.length ? activities.map((activity, index) => <div className="relative flex gap-4 pb-6 last:pb-0" key={activity.id}>{index < activities.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-18px)] w-px bg-white/[0.09]" />}<span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-subtle"><MessageSquare className="h-3.5 w-3.5 text-brand-light" /></span><div>{activity.metadata_json?.sender_name && <p className="mb-1 text-xs font-semibold text-brand-light">{activity.metadata_json.sender_name} · {humanize(activity.metadata_json.sender_role || '')}</p>}<p className="whitespace-pre-wrap text-sm font-medium">{activity.message}</p><p className="mt-1 text-xs text-content-muted">{new Date(activity.created_at).toLocaleString()}</p></div></div>) : <p className="text-sm text-content-secondary">No activity recorded yet.</p>}</div></Card>
      </div>
      <div className="space-y-5">
        <Card className="p-5"><MessageSquare className="h-5 w-5 text-brand-light" /><h2 className="mt-4 font-semibold">Ask this client</h2><p className="mt-2 text-sm leading-6 text-content-secondary">This question is sent only to {enquiry.contact_name} and stays attached to this enquiry.</p><form className="mt-5" onSubmit={(event) => { event.preventDefault(); if (question.trim().length >= 3) sendQuestion.mutate() }}><textarea className="input min-h-28 py-3" value={question} onChange={(event) => setQuestion(event.target.value)} minLength={3} maxLength={3000} required placeholder="Ask for measurements, preferences, availability…" />{sendQuestion.error && <p role="alert" className="mt-3 rounded-xl bg-red-400/10 p-3 text-xs text-red-300">{sendQuestion.error.message}</p>}<Button className="mt-3 w-full" type="submit" disabled={sendQuestion.isPending || question.trim().length < 3}><Send className="h-4 w-4" />{sendQuestion.isPending ? 'Sending…' : 'Send to this client'}</Button></form></Card>
        <Card className="p-5"><h2 className="font-semibold">Contact</h2><div className="mt-5 space-y-4"><Contact icon={UserRound} value={enquiry.contact_name} /><Contact icon={Mail} value={enquiry.email} /><Contact icon={Phone} value={enquiry.phone} /><Contact icon={MapPin} value={enquiry.location} /></div></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Quotations</h2><span className="text-xs text-content-muted">{quotations.length} versions</span></div><div className="mt-4 space-y-3">{quotations.length ? quotations.map((quote) => <Link to={`/quotations/${quote.id}`} key={quote.id} className="block rounded-xl border border-line p-3 hover:bg-white/[0.05]"><div className="flex justify-between"><p className="text-sm font-semibold">{quote.number}</p><Badge value={quote.status} /></div><p className="mt-2 text-sm text-content-secondary">{compactMoney(quote.total)}</p></Link>) : <p className="py-5 text-center text-sm text-content-secondary">No quotations created.</p>}</div></Card>
      </div>
    </div>
    {editForm && <div className="fixed inset-0 z-[80] flex justify-end bg-black/65 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-enquiry-title">
      <button type="button" aria-label="Close edit enquiry" className="absolute inset-0" onClick={() => setEditForm(null)} />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-line bg-panel p-6 shadow-elevated sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand-light">{enquiry.reference}</p><h2 id="edit-enquiry-title" className="mt-1 text-2xl font-semibold">Edit client enquiry</h2><p className="mt-2 text-sm text-content-secondary">Changes are recorded in the activity timeline.</p></div><Button aria-label="Close dialog" variant="icon" onClick={() => setEditForm(null)}><X className="h-4 w-4" /></Button></div>
        <form className="mt-8 grid gap-5 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); saveEdit.mutate(editForm) }}>
          <EditField wide label="Project / enquiry title"><input className="input" minLength={3} maxLength={180} required value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} /></EditField>
          <EditField label="Client name"><input className="input" minLength={2} maxLength={140} required value={editForm.contact_name} onChange={(event) => setEditForm({ ...editForm, contact_name: event.target.value })} /></EditField>
          <EditField label="Client email"><input className="input" type="email" autoCapitalize="none" required value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: normalizeEmailCase(event.target.value) })} /></EditField>
          <EditField label="Phone number"><input className="input" type="tel" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} title="Enter exactly 10 digits" required value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} /></EditField>
          <EditField label="Property type"><select className="input" required value={editForm.property_type} onChange={(event) => setEditForm({ ...editForm, property_type: event.target.value })}><option value="">Select</option><option>Apartment</option><option>Villa</option><option>Office</option><option>Retail</option><option>Other</option></select></EditField>
          <EditField wide label="Location"><input className="input" minLength={2} maxLength={180} required value={editForm.location} onChange={(event) => setEditForm({ ...editForm, location: event.target.value })} /></EditField>
          <EditField label="Area (sq ft)"><input className="input" type="number" min="1" value={editForm.area_sqft} onChange={(event) => setEditForm({ ...editForm, area_sqft: event.target.value })} /></EditField>
          <EditField label="Expected start date"><input className="input" type="date" value={editForm.expected_start_date} onChange={(event) => setEditForm({ ...editForm, expected_start_date: event.target.value })} /></EditField>
          <EditField label="Budget from"><input className="input" type="number" min="0" value={editForm.budget_min} onChange={(event) => setEditForm({ ...editForm, budget_min: event.target.value })} /></EditField>
          <EditField label="Budget to"><input className="input" type="number" min="0" value={editForm.budget_max} onChange={(event) => setEditForm({ ...editForm, budget_max: event.target.value })} /></EditField>
          <EditField label="Lead source"><input className="input" minLength={2} maxLength={60} required value={editForm.source} onChange={(event) => setEditForm({ ...editForm, source: event.target.value })} /></EditField>
          <EditField label="Pipeline status"><select className="input" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>{enquiryStatuses.map((value) => <option value={value} key={value}>{humanize(value)}</option>)}</select></EditField>
          <EditField wide label="Client requirements"><textarea className="input min-h-32 py-3" maxLength={3000} value={editForm.requirements} onChange={(event) => setEditForm({ ...editForm, requirements: event.target.value })} /></EditField>
          {saveEdit.error && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300 sm:col-span-2">{saveEdit.error.message}</p>}
          <div className="flex justify-end gap-3 border-t border-line pt-5 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setEditForm(null)}>Cancel</Button><Button type="submit" disabled={saveEdit.isPending}>{saveEdit.isPending ? 'Saving…' : 'Save changes'}</Button></div>
        </form>
      </aside>
    </div>}
  </>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-content-muted">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
}
function Contact({ icon: Icon, value }: { icon: typeof UserRound; value: string }) {
  return <div className="flex items-start gap-3"><span className="rounded-lg bg-subtle p-2"><Icon className="h-4 w-4 text-content-secondary" /></span><p className="pt-1.5 text-sm text-content-secondary">{value}</p></div>
}
function EditField({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? 'sm:col-span-2' : ''}><span className="label">{label}</span>{children}</label>
}
