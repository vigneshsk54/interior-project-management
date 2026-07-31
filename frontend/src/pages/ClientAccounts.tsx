import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Eye, EyeOff, KeyRound, Plus, UserRoundCheck, UsersRound, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Paginated, User } from '../lib/types'
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader, StatCard } from '../components/ui'

interface CustomerOption {
  id: string
  name: string
  email: string
  phone: string
  company?: string
}

const initialForm = { customer_id: '', password: '', confirm_password: '' }

export function ClientAccounts() {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState('')
  const [created, setCreated] = useState<User | null>(null)
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api<User[]>('/users'),
  })
  const customers = useQuery({
    queryKey: ['customers', 'client-account-options'],
    queryFn: () => api<Paginated<CustomerOption>>('/customers?page_size=100'),
  })
  const clientUsers = useMemo(
    () => users.data?.filter((user) => user.role === 'client') || [],
    [users.data],
  )
  const availableCustomers = useMemo(() => {
    const accountEmails = new Set((users.data || []).map((user) => user.email.toLowerCase()))
    return (customers.data?.items || []).filter(
      (customer) => !accountEmails.has(customer.email.toLowerCase()),
    )
  }, [customers.data?.items, users.data])
  const selectedCustomer = availableCustomers.find((customer) => customer.id === form.customer_id)
  const create = useMutation({
    mutationFn: () => api<User>('/users/clients', {
      method: 'POST',
      body: JSON.stringify({ customer_id: form.customer_id, password: form.password }),
    }),
    onSuccess: (account) => {
      setCreated(account)
      setOpen(false)
      setForm(initialForm)
      setFormError('')
      client.invalidateQueries({ queryKey: ['users'] })
      client.invalidateQueries({ queryKey: ['customers', 'client-account-options'] })
    },
  })
  const close = () => {
    setOpen(false)
    setForm(initialForm)
    setFormError('')
    create.reset()
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (!form.customer_id) {
      setFormError('Select a customer.')
      return
    }
    if (form.password.length < 12) {
      setFormError('The temporary password must be at least 12 characters.')
      return
    }
    if (form.password !== form.confirm_password) {
      setFormError('The passwords do not match.')
      return
    }
    create.mutate()
  }

  if (users.isLoading || customers.isLoading) return <Loading label="Loading client access…" />
  if (users.error) return <ErrorState error={users.error} />
  if (customers.error) return <ErrorState error={customers.error} />

  return <>
    <PageHeader
      eyebrow="Administration"
      title="Client access"
      description="Create secure sign-in accounts for existing customers so they can use the client portal."
      action={<Button onClick={() => setOpen(true)} disabled={!availableCustomers.length}><Plus className="h-4 w-4" />Create client sign-in</Button>}
    />

    {created && <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-200" role="status"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Client sign-in created</p><p className="mt-1 break-all text-xs text-emerald-200/75">{created.full_name} can now sign in with {created.email}.</p></div><button className="text-emerald-200/70 hover:text-white" onClick={() => setCreated(null)} aria-label="Dismiss confirmation"><X className="h-4 w-4" /></button></div>}

    <div className="mb-5 grid auto-rows-fr gap-4 sm:grid-cols-3">
      <StatCard label="Client sign-ins" value={clientUsers.length} icon={UserRoundCheck} note="Active and inactive client portal users" />
      <StatCard label="Customers without access" value={availableCustomers.length} icon={UsersRound} note="Eligible for a new sign-in account" />
      <StatCard label="Account security" value="12+ chars" icon={KeyRound} note="Minimum temporary password length" />
    </div>

    {!clientUsers.length ? <Card><Empty title="No client sign-ins yet" message="Create an account for an existing customer to grant portal access." /></Card> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-white/[0.035] text-[11px] uppercase tracking-wider"><tr><th>Client</th><th>Email</th><th>Role</th><th>Status</th><th>Client details</th></tr></thead><tbody className="divide-y divide-line">{clientUsers.map((account) => { const customer = customers.data?.items.find((item) => item.email.toLowerCase() === account.email.toLowerCase()); return <tr className="hover:bg-white/[0.035]" key={account.id}><td><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/20 bg-brand/10 text-xs font-bold text-brand-light">{account.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span className="font-semibold">{account.full_name}</span></div></td><td className="text-content-secondary">{account.email}</td><td><Badge value={account.role} /></td><td><Badge value={account.is_active ? 'approved' : 'blocked'} /></td><td>{customer ? <Link className="text-xs font-semibold text-brand-light hover:text-white" to={`/customers/${customer.id}`}>View profile & work →</Link> : <span className="text-xs text-content-muted">Profile not linked</span>}</td></tr> })}</tbody></table></div></Card>}

    {open && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="client-account-title"><button className="absolute inset-0" aria-label="Close" onClick={close} /><form onSubmit={submit} className="surface relative max-h-[90vh] w-full max-w-xl overflow-auto p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand-light">Portal credentials</p><h2 id="client-account-title" className="mt-1 text-xl font-semibold">Create client sign-in</h2><p className="mt-2 text-sm leading-6 text-content-secondary">Choose an existing customer and set their temporary password.</p></div><button type="button" className="icon-btn" onClick={close} aria-label="Close dialog"><X className="h-4 w-4" /></button></div>
      <div className="mt-7 space-y-5">
        <label><span className="label">Customer</span><select className="input" required value={form.customer_id} onChange={(event) => setForm({ ...form, customer_id: event.target.value })}><option value="">Select a customer</option>{availableCustomers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name} — {customer.email}</option>)}</select></label>
        {selectedCustomer && <div className="rounded-2xl border border-line bg-subtle p-4"><p className="text-sm font-semibold">{selectedCustomer.name}</p><p className="mt-1 text-xs text-content-secondary">{selectedCustomer.email}</p><p className="mt-1 text-xs text-content-muted">{selectedCustomer.company || selectedCustomer.phone}</p></div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="label">Temporary password</span><div className="relative"><input className="input pr-11" type={showPassword ? 'text' : 'password'} minLength={12} autoComplete="new-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" className="absolute right-3 top-3 text-content-muted hover:text-content" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></label>
          <label><span className="label">Confirm password</span><input className="input" type={showPassword ? 'text' : 'password'} minLength={12} autoComplete="new-password" required value={form.confirm_password} onChange={(event) => setForm({ ...form, confirm_password: event.target.value })} /></label>
        </div>
        <p className="text-xs leading-5 text-content-muted">Share the credentials securely. The client must use the dedicated Client login and can only access their own portal records.</p>
      </div>
      {(formError || create.error) && <p className="mt-5 rounded-xl bg-red-400/10 p-3 text-sm text-red-300" role="alert">{formError || create.error?.message}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-line pt-5"><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating sign-in…' : 'Create sign-in'}</Button></div>
    </form></div>}
  </>
}
