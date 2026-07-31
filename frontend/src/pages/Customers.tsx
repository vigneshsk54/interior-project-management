import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Building2, Mail, MapPin, Phone, Plus, Search, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, humanize } from '../lib/api'
import type { Enquiry, Paginated, Project } from '../lib/types'
import { isValidEmail, isValidPhone, normalizeEmailCase } from '../lib/validation'
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader, Progress } from '../components/ui'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  company?: string
  billing_address?: string
  notes: string
  tags: string[]
  created_at: string
}

interface CustomerDetailData {
  customer: Customer
  enquiries: Enquiry[]
  projects: Project[]
}

const emptyCustomer = {
  name: '', email: '', phone: '', company: '', billing_address: '', notes: '', tags: '',
}

export function Customers() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyCustomer)
  const [formError, setFormError] = useState('')
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['customers', search],
    queryFn: () => api<Paginated<Customer>>(`/customers?search=${encodeURIComponent(search)}`),
  })
  const create = useMutation({
    mutationFn: () => api<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify({ ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) }),
    }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['customers'] })
      setOpen(false)
      setForm(emptyCustomer)
      setFormError('')
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (!isValidEmail(form.email)) {
      setFormError('Enter a valid email address.')
      return
    }
    if (!isValidPhone(form.phone)) {
      setFormError('Phone number must contain exactly 10 digits.')
      return
    }
    create.mutate()
  }
  return <>
    <PageHeader eyebrow="Relationships" title="Customers" description="A complete view of every client, property, conversation and project." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add customer</Button>} />
    <div className="relative mb-4 max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-content-muted" /><input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers…" /></div>
    {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : !query.data?.items.length ? <Card><Empty title="No customers found" /></Card> : <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data.items.map((customer) => <Link to={`/customers/${customer.id}`} key={customer.id}><Card variant="interactive" className="h-full p-5"><div className="flex items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-subtle text-sm font-bold text-brand-light">{customer.name.split(' ').map((value) => value[0]).slice(0, 2).join('')}</div><div className="min-w-0"><p className="truncate font-semibold">{customer.name}</p><p className="mt-1 flex items-center gap-1.5 truncate text-xs text-content-secondary"><Mail className="h-3 w-3" />{customer.email}</p>{customer.company && <p className="mt-1 flex items-center gap-1.5 text-xs text-content-secondary"><Building2 className="h-3 w-3" />{customer.company}</p>}</div></div><div className="mt-5 flex flex-wrap gap-2">{customer.tags.map((tag) => <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-content-secondary" key={tag}>{tag}</span>)}</div></Card></Link>)}</div>}
    {open && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><button className="absolute inset-0" aria-label="Close" onClick={() => setOpen(false)} /><form onSubmit={submit} className="surface relative max-h-[90vh] w-full max-w-xl overflow-auto p-6 sm:p-8"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-brand">New relationship</p><h2 className="mt-1 text-xl font-semibold">Add customer</h2></div><button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close dialog"><X className="h-4 w-4" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Input label="Name" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input label="Email" type="email" required value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><Input label="Phone" type="tel" phone required value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Input label="Company" value={form.company} onChange={(value) => setForm({ ...form, company: value })} /><div className="sm:col-span-2"><Input label="Billing address" value={form.billing_address} onChange={(value) => setForm({ ...form, billing_address: value })} /></div><div className="sm:col-span-2"><Input label="Tags (comma separated)" value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} /></div><label className="sm:col-span-2"><span className="label">Notes</span><textarea className="input h-24 py-3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div>{(formError || create.error) && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{formError || create.error?.message}</p>}<div className="mt-6 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Save customer'}</Button></div></form></div>}
  </>
}

export function CustomerDetail() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api<CustomerDetailData>(`/customers/${id}`),
    enabled: Boolean(id),
  })
  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorState error={query.error} />
  if (!query.data) return null
  const { customer, enquiries, projects } = query.data
  return <>
    <Link to="/customers" className="mb-5 inline-flex items-center gap-2 text-sm text-content-secondary"><ArrowLeft className="h-4 w-4" />Back to customers</Link>
    <PageHeader eyebrow="Customer profile" title={customer.name} description={customer.company || 'Private client'} />
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.4fr]"><div className="space-y-5"><Card className="p-5"><h2 className="font-semibold">Contact details</h2><div className="mt-5 space-y-4 text-sm text-content-secondary"><p className="flex gap-3"><Mail className="h-4 w-4 text-brand-light" />{customer.email}</p><p className="flex gap-3"><Phone className="h-4 w-4 text-brand-light" />{customer.phone}</p><p className="flex gap-3"><MapPin className="h-4 w-4 text-brand-light" />{customer.billing_address || 'No billing address'}</p></div></Card><Card className="p-5"><h2 className="font-semibold">Notes</h2><p className="mt-3 text-sm leading-6 text-content-secondary">{customer.notes || 'No notes added.'}</p></Card></div><div className="space-y-5"><Card className="overflow-hidden"><div className="border-b border-line p-5"><h2 className="font-semibold">Projects</h2></div>{projects.length ? <div className="divide-y divide-line">{projects.map((project) => <Link to={`/projects/${project.id}`} className="block p-5 hover:bg-white/[0.05]" key={project.id}><div className="flex justify-between gap-3"><div><p className="font-semibold">{project.name}</p><p className="mt-1 text-xs text-content-secondary">{humanize(project.stage)} · {project.location}</p></div><Badge value={project.health} /></div><div className="mt-3"><Progress value={project.progress} /></div></Link>)}</div> : <Empty title="No linked projects" />}</Card><Card className="overflow-hidden"><div className="border-b border-line p-5"><h2 className="font-semibold">Enquiries</h2></div>{enquiries.length ? <div className="divide-y divide-line">{enquiries.map((enquiry) => <Link to={`/enquiries/${enquiry.id}`} className="flex items-center justify-between p-4 hover:bg-white/[0.05]" key={enquiry.id}><div><p className="text-sm font-semibold">{enquiry.title}</p><p className="mt-1 text-xs text-content-muted">Studio: {enquiry.reference}</p><p className="mt-0.5 text-xs text-content-muted">Client: {enquiry.client_reference}</p></div><Badge value={enquiry.status} /></Link>)}</div> : <Empty title="No linked enquiries" />}</Card></div></div>
  </>
}

function Input({ label, value, onChange, type = 'text', required = false, phone = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; phone?: boolean }) {
  return <label><span className="label">{label}</span><input className="input" type={type} autoCapitalize={type === 'email' ? 'none' : undefined} required={required} inputMode={phone ? 'numeric' : undefined} minLength={phone ? 10 : undefined} maxLength={phone ? 10 : undefined} pattern={phone ? '[0-9]{10}' : undefined} title={phone ? 'Enter exactly 10 digits' : undefined} value={value} onChange={(event) => onChange(type === 'email' ? normalizeEmailCase(event.target.value) : event.target.value)} /></label>
}
