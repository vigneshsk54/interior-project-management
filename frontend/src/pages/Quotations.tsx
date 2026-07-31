import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText, Plus, Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, compactMoney, money } from '../lib/api'
import type { Paginated, Quotation } from '../lib/types'
import { Badge, Button, Card, ErrorState, Loading, PageHeader } from '../components/ui'

export function Quotations() {
  const query = useQuery({ queryKey: ['quotations'], queryFn: () => api<Paginated<Quotation>>('/quotations') })
  return <>
    <PageHeader eyebrow="Commercials" title="Quotations" description="Build accurate, versioned estimates and move approved work directly into delivery." action={<Link className="btn-primary" to="/quotations/new"><Plus className="h-4 w-4" />New quotation</Link>} />
    {query.isLoading ? <Loading /> : query.error ? <ErrorState error={query.error} /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead className="bg-white/[0.035] text-[11px] uppercase tracking-[.1em] text-content-secondary"><tr><th className="px-5 py-4">Quote</th><th className="px-4">Title</th><th className="px-4">Version</th><th className="px-4">Valid until</th><th className="px-4">Value</th><th className="px-4">Status</th></tr></thead><tbody className="divide-y divide-line">{query.data?.items.map((quote) => <tr key={quote.id} className="hover:bg-white/[0.05]"><td className="px-5 py-4"><Link className="font-semibold hover:text-brand" to={`/quotations/${quote.id}`}>{quote.number}</Link></td><td className="px-4 py-4 text-sm">{quote.title}</td><td className="px-4 py-4 text-sm">v{quote.current_version}</td><td className="px-4 py-4 text-sm text-content-secondary">{quote.valid_until || '—'}</td><td className="px-4 py-4 font-semibold">{compactMoney(quote.total)}</td><td className="px-4 py-4"><Badge value={quote.status} /></td></tr>)}</tbody></table></div></Card>}
  </>
}

interface LineItem { id: string; room: string; category: string; description: string; quantity: number; unit: string; rate: number; tax_rate: number; margin_rate: number }
const blankItem = (): LineItem => ({ id: crypto.randomUUID(), room: 'Living Room', category: 'Custom Furniture', description: '', quantity: 1, unit: 'lot', rate: 0, tax_rate: 18, margin_rate: 12 })

export function QuotationBuilder() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [enquiryId, setEnquiryId] = useState(params.get('enquiry') || '')
  const [title, setTitle] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [discount, setDiscount] = useState(0)
  const [items, setItems] = useState<LineItem[]>([blankItem()])
  const enquiries = useQuery({ queryKey: ['enquiries', 'quote-options'], queryFn: () => api<Paginated<{ id: string; reference: string; title: string }>>('/enquiries?page_size=100') })
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate * (1 + item.margin_rate / 100), 0)
    const tax = items.reduce((sum, item) => sum + item.quantity * item.rate * (1 + item.margin_rate / 100) * item.tax_rate / 100, 0)
    return { subtotal, tax, total: Math.max(0, subtotal + tax - discount) }
  }, [discount, items])
  const create = useMutation({
    mutationFn: () => api<Quotation>('/quotations', { method: 'POST', body: JSON.stringify({ enquiry_id: enquiryId, title, valid_until: validUntil || null, discount, items: items.map((item) => ({ room: item.room, category: item.category, description: item.description, quantity: item.quantity, unit: item.unit, rate: item.rate, tax_rate: item.tax_rate, margin_rate: item.margin_rate })) }) }),
    onSuccess: (quote) => navigate(`/quotations/${quote.id}`),
  })
  const updateItem = (id: string, field: keyof LineItem, value: string | number) => setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item))
  return <>
    <Link to="/quotations" className="mb-5 inline-flex items-center gap-2 text-sm text-content-secondary"><ArrowLeft className="h-4 w-4" />Back to quotations</Link>
    <PageHeader eyebrow="Estimate builder" title="New quotation" description="Create a room-by-room commercial proposal with automatic margin and tax calculations." action={<Button disabled={create.isPending || !enquiryId || !title || items.some((item) => !item.description)} onClick={() => create.mutate()}><Send className="h-4 w-4" />{create.isPending ? 'Saving…' : 'Save quotation'}</Button>} />
    <div className="grid gap-5 xl:grid-cols-[1fr_330px]"><div className="space-y-5">
      <Card className="grid gap-4 p-5 sm:grid-cols-3"><label><span className="label">Enquiry</span><select className="input" value={enquiryId} onChange={(e) => setEnquiryId(e.target.value)}><option value="">Select enquiry</option>{enquiries.data?.items.map((item) => <option value={item.id} key={item.id}>{item.reference} — {item.title}</option>)}</select></label><label><span className="label">Quotation title</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Full interior works" /></label><label><span className="label">Valid until</span><input className="input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></label></Card>
      <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5"><div><p className="font-semibold">Line items</p><p className="mt-1 text-xs text-content-secondary">Organize scope by room and trade.</p></div><Button variant="secondary" onClick={() => setItems([...items, blankItem()])}><Plus className="h-4 w-4" />Add item</Button></div><div className="space-y-4 p-4">{items.map((item, index) => <div className="rounded-xl border border-line bg-white/[0.02] p-4" key={item.id}><div className="mb-4 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-content-muted">Item {index + 1}</p><button type="button" aria-label={`Remove item ${index + 1}`} className="icon-btn h-8 w-8 border-red-400/10 text-content-muted hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-300" onClick={() => setItems(items.filter((row) => row.id !== item.id))}><Trash2 className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MiniInput label="Room" value={item.room} onChange={(v) => updateItem(item.id, 'room', v)} /><MiniInput label="Category" value={item.category} onChange={(v) => updateItem(item.id, 'category', v)} /><div className="sm:col-span-2"><MiniInput label="Description" value={item.description} onChange={(v) => updateItem(item.id, 'description', v)} /></div><MiniInput label="Quantity" type="number" value={item.quantity} onChange={(v) => updateItem(item.id, 'quantity', Number(v))} /><MiniInput label="Unit" value={item.unit} onChange={(v) => updateItem(item.id, 'unit', v)} /><MiniInput label="Rate" type="number" value={item.rate} onChange={(v) => updateItem(item.id, 'rate', Number(v))} /><MiniInput label="Tax %" type="number" value={item.tax_rate} onChange={(v) => updateItem(item.id, 'tax_rate', Number(v))} /></div></div>)}</div></Card>
    </div><Card className="h-fit p-5 xl:sticky xl:top-24"><p className="font-semibold">Commercial summary</p><div className="mt-6 space-y-4 text-sm"><Summary label="Subtotal" value={money(totals.subtotal)} /><Summary label="Tax" value={money(totals.tax)} /><label><span className="label">Discount</span><input className="input text-right" type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></label><div className="border-t border-line pt-4"><Summary label="Quotation total" value={money(totals.total)} strong /></div></div>{create.error && <p className="mt-5 rounded-xl bg-red-400/10 p-3 text-xs text-red-300">{create.error.message}</p>}<div className="mt-6 rounded-xl bg-subtle p-4 text-xs leading-5 text-content-secondary">All values are saved as a version. Tax and margin are calculated independently for each line.</div></Card></div>
  </>
}

function MiniInput({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) { return <label><span className="label">{label}</span><input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} min={type === 'number' ? 0 : undefined} /></label> }
function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className={`flex justify-between ${strong ? 'text-base font-semibold' : 'text-content-secondary'}`}><span>{label}</span><span>{value}</span></div> }

interface QuoteDetail { quotation: Quotation; items: LineItem[]; versions: { id: string; version: number; total: number }[] }
export function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['quotation', id], queryFn: () => api<QuoteDetail>(`/quotations/${id}`) })
  const approve = useMutation({ mutationFn: () => api<{ id: string }>(`/quotations/${id}/approve`, { method: 'POST' }), onSuccess: (project) => navigate(`/projects/${project.id}`) })
  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorState error={query.error} />
  if (!query.data) return null
  const { quotation, items } = query.data
  return <><Link to="/quotations" className="mb-5 inline-flex items-center gap-2 text-sm text-content-secondary"><ArrowLeft className="h-4 w-4" />Back to quotations</Link><PageHeader eyebrow={quotation.number} title={quotation.title} description={`Version ${quotation.current_version} · Valid until ${quotation.valid_until || 'not set'}`} action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => window.print()}><FileText className="h-4 w-4" />Print / PDF</Button>{quotation.status !== 'approved' && <Button disabled={approve.isPending} onClick={() => approve.mutate()}>{approve.isPending ? 'Converting…' : 'Approve & create project'}</Button>}</div>} />{approve.error && <p className="mb-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{approve.error.message}</p>}<Card className="mx-auto max-w-4xl overflow-hidden"><div className="flex justify-between border-b border-line p-5 sm:p-7"><div><p className="text-lg font-semibold">ATELIER FLOW</p><p className="mt-1 text-xs text-content-muted">Interior architecture & delivery</p></div><Badge value={quotation.status} /></div><div className="p-5 sm:p-7"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-line text-xs uppercase tracking-wide text-content-muted"><tr><th className="pb-3">Scope</th><th className="pb-3">Room</th><th className="pb-3 text-right">Qty</th><th className="pb-3 text-right">Rate</th></tr></thead><tbody className="divide-y divide-line">{items.map((item) => <tr key={item.id}><td className="py-4"><p className="font-medium">{item.description}</p><p className="mt-1 text-xs text-content-muted">{item.category}</p></td><td>{item.room}</td><td className="text-right">{item.quantity} {item.unit}</td><td className="text-right">{money(item.rate)}</td></tr>)}</tbody></table></div><div className="ml-auto mt-7 w-full max-w-xs space-y-3 text-sm"><Summary label="Subtotal" value={money(quotation.subtotal)} /><Summary label="Tax" value={money(quotation.tax)} /><Summary label="Discount" value={`− ${money(quotation.discount)}`} /><div className="border-t border-line pt-3"><Summary label="Total" value={money(quotation.total)} strong /></div></div></div></Card></>
}
