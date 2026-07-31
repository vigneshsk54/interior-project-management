import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Columns3, List, Mail, MapPin, MoreHorizontal, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { api, compactMoney, humanize } from '../lib/api'
import type { Enquiry, Paginated } from '../lib/types'
import { emailSchema, lowercaseEmailInput, phoneSchema } from '../lib/validation'
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader } from '../components/ui'

const stages = ['new', 'contacted', 'site_visit_scheduled', 'requirement_collected', 'quotation_sent', 'negotiation']
const schema = z.object({
  title: z.string().min(3), contact_name: z.string().min(2), email: emailSchema,
  phone: phoneSchema, property_type: z.string().min(2), location: z.string().min(2),
  area_sqft: z.coerce.number().positive().optional(), budget_min: z.coerce.number().nonnegative().optional(),
  budget_max: z.coerce.number().nonnegative().optional(), requirements: z.string().default(''), source: z.string().default('Website'),
})
type FormData = z.infer<typeof schema>

export function Enquiries() {
  const [view, setView] = useState<'table' | 'board'>('table')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['enquiries', search, status], queryFn: () => api<Paginated<Enquiry>>(`/enquiries?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page_size=100`) })
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { source: 'Website', requirements: '' } })
  const create = useMutation({
    mutationFn: (values: FormData) => api<Enquiry>('/enquiries', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['enquiries'] }); setOpen(false); form.reset() },
  })
  return <>
    <PageHeader eyebrow="Sales pipeline" title="Enquiries" description="Capture, qualify and convert every new opportunity from first contact to signed project." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New enquiry</Button>} />
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative max-w-md flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-content-muted" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9" placeholder="Search name, project or reference…" /></div>
      <Button variant="secondary" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal className="h-4 w-4" />Filters{status && <span className="h-2 w-2 rounded-full bg-brand" />}</Button>
      <div className="flex rounded-xl border border-line bg-panel p-1"><button onClick={() => setView('table')} className={`rounded-lg p-2 ${view === 'table' ? 'bg-app text-white' : 'text-content-secondary'}`} aria-label="Table view"><List className="h-4 w-4" /></button><button onClick={() => setView('board')} className={`rounded-lg p-2 ${view === 'board' ? 'bg-app text-white' : 'text-content-secondary'}`} aria-label="Board view"><Columns3 className="h-4 w-4" /></button></div>
    </div>
    {filtersOpen && <Card className="mb-4 flex flex-wrap items-end gap-4 p-4"><label><span className="label">Pipeline status</span><select className="input w-56" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{[...stages, 'won', 'lost'].map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label><Button variant="ghost" onClick={() => setStatus('')}>Clear filters</Button></Card>}
    {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : !query.data?.items.length ? <Card><Empty title="No enquiries found" message="Adjust your search or add a new enquiry to begin." /></Card> : view === 'table' ? <EnquiryTable items={query.data.items} /> : <EnquiryBoard items={query.data.items} />}
    {open && <div className="fixed inset-0 z-[80] flex justify-end bg-black/65 backdrop-blur-sm" role="dialog" aria-modal="true"><button aria-label="Close" className="absolute inset-0" onClick={() => setOpen(false)} /><aside className="relative h-full w-full max-w-xl overflow-auto border-l border-line bg-panel p-6 shadow-elevated sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand">New opportunity</p><h2 className="mt-1 text-2xl font-semibold">Create enquiry</h2><p className="mt-1 text-sm text-content-secondary">Add the essentials now; details can be completed later.</p></div><button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close dialog"><X className="h-4 w-4" /></button></div><form onSubmit={form.handleSubmit((values) => create.mutate(values))} className="mt-8 grid gap-5 sm:grid-cols-2">
      <Field label="Project / enquiry title" error={form.formState.errors.title?.message} wide><input className="input" {...form.register('title')} placeholder="e.g. Mehta Residence" /></Field>
      <Field label="Contact name" error={form.formState.errors.contact_name?.message}><input className="input" {...form.register('contact_name')} /></Field>
      <Field label="Email" error={form.formState.errors.email?.message}><input className="input" type="email" autoCapitalize="none" onInput={lowercaseEmailInput} {...form.register('email')} /></Field>
      <Field label="Phone" error={form.formState.errors.phone?.message}><input className="input" type="tel" inputMode="numeric" minLength={10} maxLength={10} {...form.register('phone')} /></Field>
      <Field label="Property type"><select className="input" {...form.register('property_type')}><option value="">Select</option><option>Apartment</option><option>Villa</option><option>Office</option><option>Retail</option></select></Field>
      <Field label="Location" error={form.formState.errors.location?.message} wide><input className="input" {...form.register('location')} placeholder="Area, city" /></Field>
      <Field label="Area (sq ft)"><input className="input" type="number" {...form.register('area_sqft')} /></Field>
      <Field label="Lead source"><select className="input" {...form.register('source')}><option>Website</option><option>Instagram</option><option>Referral</option><option>Architect Partner</option><option>Walk-in</option></select></Field>
      <Field label="Budget from"><input className="input" type="number" {...form.register('budget_min')} /></Field>
      <Field label="Budget to"><input className="input" type="number" {...form.register('budget_max')} /></Field>
      <Field label="Requirements" wide><textarea className="input h-24 py-3" {...form.register('requirements')} /></Field>
      {create.error && <p className="sm:col-span-2 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{create.error.message}</p>}
      <div className="flex justify-end gap-3 border-t border-line pt-5 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create enquiry'}</Button></div>
    </form></aside></div>}
  </>
}

function Field({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? 'sm:col-span-2' : ''}><span className="label">{label}</span>{children}{error && <span className="mt-1 block text-xs text-red-300">{error}</span>}</label>
}

function EnquiryTable({ items }: { items: Enquiry[] }) {
  return <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="border-b border-line bg-white/[0.025] text-[11px] uppercase tracking-[.1em] text-content-secondary"><tr><th className="px-5 py-3.5 font-semibold">Enquiry</th><th className="px-4 py-3.5 font-semibold">Contact</th><th className="px-4 py-3.5 font-semibold">Property</th><th className="px-4 py-3.5 font-semibold">Budget</th><th className="px-4 py-3.5 font-semibold">Status</th><th className="px-4 py-3.5 font-semibold">Source</th><th className="w-12" /></tr></thead><tbody className="divide-y divide-line">{items.map((item) => <tr key={item.id} className="group hover:bg-white/[0.025]"><td className="px-5 py-4"><Link to={`/enquiries/${item.id}`} className="text-sm font-semibold hover:text-brand">{item.title}</Link><p className="mt-1 text-xs text-content-muted">Studio: {item.reference}</p><p className="mt-0.5 text-xs text-content-muted">Client: {item.client_reference}</p></td><td className="px-4 py-4"><p className="text-sm">{item.contact_name}</p><p className="mt-1 flex items-center gap-1 text-xs text-content-muted"><Mail className="h-3 w-3" />{item.email}</p></td><td className="px-4 py-4"><p className="text-sm">{item.property_type}</p><p className="mt-1 flex items-center gap-1 text-xs text-content-muted"><MapPin className="h-3 w-3" />{item.location}</p></td><td className="px-4 py-4 text-sm">{item.budget_min ? `${compactMoney(item.budget_min)}–${compactMoney(item.budget_max || item.budget_min)}` : '—'}</td><td className="px-4 py-4"><Badge value={item.status} /></td><td className="px-4 py-4 text-sm text-content-secondary">{item.source}</td><td><Link aria-label={`View ${item.title}`} to={`/enquiries/${item.id}`} className="icon-btn h-8 w-8 border-0"><MoreHorizontal className="h-4 w-4" /></Link></td></tr>)}</tbody></table></div></Card>
}

function EnquiryBoard({ items }: { items: Enquiry[] }) {
  return <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-3">{stages.map((stage) => { const stageItems = items.filter((item) => item.status === stage); return <div className="w-[290px] shrink-0" key={stage}><div className="mb-3 flex items-center justify-between px-1"><p className="text-sm font-semibold">{humanize(stage)}</p><span className="grid h-6 min-w-6 place-items-center rounded-full bg-white/[0.09] px-1.5 text-xs">{stageItems.length}</span></div><div className="space-y-3 rounded-2xl bg-subtle/70 p-2">{stageItems.map((item) => <Link to={`/enquiries/${item.id}`} key={item.id} className="block rounded-xl border border-line bg-panel p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"><p className="text-xs text-content-muted">Studio: {item.reference}</p><p className="mt-0.5 text-xs text-content-muted">Client: {item.client_reference}</p><p className="mt-2 text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-content-secondary">{item.contact_name}</p><div className="mt-4 flex items-center justify-between text-xs"><span className="text-content-secondary">{item.location.split(',')[0]}</span><span className="font-semibold">{item.budget_max ? compactMoney(item.budget_max) : '—'}</span></div></Link>)}{!stageItems.length && <p className="py-8 text-center text-xs text-content-muted">No enquiries</p>}</div></div> })}</div>
}
