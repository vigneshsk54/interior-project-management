import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Eye, EyeOff, KeyRound, Plus, ShieldCheck, UserCog, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { api, humanize } from '../lib/api'
import type { Role, User } from '../lib/types'
import { isValidEmail, isValidPhone, normalizeEmailCase } from '../lib/validation'
import { Badge, Button, Card, Empty, ErrorState, Loading, PageHeader, StatCard } from '../components/ui'

const teamRoles: Role[] = ['admin', 'sales_manager', 'interior_designer', 'project_manager', 'site_supervisor']
const initialForm = {
  full_name: '',
  email: '',
  phone: '',
  role: 'project_manager' as Role,
  password: '',
  confirm_password: '',
}

export function TeamAccounts() {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState('')
  const [created, setCreated] = useState<User | null>(null)
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<User[]>('/users') })
  const team = useMemo(() => users.data?.filter((user) => teamRoles.includes(user.role)) || [], [users.data])
  const create = useMutation({
    mutationFn: () => api<User>('/users/team', {
      method: 'POST',
      body: JSON.stringify({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        role: form.role,
        password: form.password,
      }),
    }),
    onSuccess: (account) => {
      setCreated(account)
      setOpen(false)
      setForm(initialForm)
      setFormError('')
      client.invalidateQueries({ queryKey: ['users'] })
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
    if (!isValidEmail(form.email)) {
      setFormError('Enter a valid email address.')
      return
    }
    if (form.phone && !isValidPhone(form.phone)) {
      setFormError('Phone number must contain exactly 10 digits.')
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

  if (users.isLoading) return <Loading label="Loading team access…" />
  if (users.error) return <ErrorState error={users.error} />

  return <>
    <PageHeader eyebrow="Administration" title="Admin & team access" description="Only an existing administrator can create another administrator or studio team account." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add team account</Button>} />
    {created && <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-200" role="status"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Team account created</p><p className="mt-1 break-all text-xs text-emerald-200/75">{created.full_name} can use the Admin / Team login with {created.email}.</p></div><button onClick={() => setCreated(null)} aria-label="Dismiss confirmation"><X className="h-4 w-4" /></button></div>}
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><StatCard label="Team accounts" value={team.length} icon={UserCog} note="Administrators and studio staff" /><StatCard label="Administrators" value={team.filter((user) => user.role === 'admin').length} icon={ShieldCheck} note="Can create accounts and manage settings" /><StatCard label="Password policy" value="12+ chars" icon={KeyRound} note="Applied to every new account" /></div>
    {!team.length ? <Card><Empty title="No team accounts" message="Create the first managed studio account." /></Card> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-white/[0.035] text-[11px] uppercase tracking-wider"><tr><th>Team member</th><th>Email</th><th>Access role</th><th>Status</th></tr></thead><tbody className="divide-y divide-line">{team.map((account) => <tr key={account.id} className="hover:bg-white/[0.035]"><td><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/20 bg-brand/10 text-xs font-bold text-brand-light">{account.full_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span className="font-semibold">{account.full_name}</span></div></td><td className="text-content-secondary">{account.email}</td><td><Badge value={account.role} /></td><td><Badge value={account.is_active ? 'approved' : 'blocked'} /></td></tr>)}</tbody></table></div></Card>}

    {open && <div className="fixed inset-0 z-[80] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="team-account-title"><button className="absolute inset-0" aria-label="Close" onClick={close} /><form className="surface relative max-h-[90vh] w-full max-w-xl overflow-auto p-6 sm:p-8" onSubmit={submit}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-brand-light">Admin-authorized account</p><h2 id="team-account-title" className="mt-1 text-xl font-semibold">Add admin or team member</h2><p className="mt-2 text-sm leading-6 text-content-secondary">Assign the minimum role needed for this person’s work.</p></div><button type="button" className="icon-btn" onClick={close} aria-label="Close dialog"><X className="h-4 w-4" /></button></div>
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <label><span className="label">Full name</span><input className="input" required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
        <label><span className="label">Access role</span><select className="input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>{teamRoles.map((role) => <option value={role} key={role}>{humanize(role)}</option>)}</select></label>
        <label className="sm:col-span-2"><span className="label">Email address</span><input className="input" type="email" autoCapitalize="none" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: normalizeEmailCase(event.target.value) })} /></label>
        <label className="sm:col-span-2"><span className="label">Phone number (optional)</span><input className="input" type="tel" inputMode="numeric" minLength={10} maxLength={10} pattern="[0-9]{10}" title="Enter exactly 10 digits" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label><span className="label">Temporary password</span><div className="relative"><input className="input pr-11" type={showPassword ? 'text' : 'password'} minLength={12} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" className="absolute right-3 top-3 text-content-muted" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></label>
        <label><span className="label">Confirm password</span><input className="input" type={showPassword ? 'text' : 'password'} minLength={12} required value={form.confirm_password} onChange={(event) => setForm({ ...form, confirm_password: event.target.value })} /></label>
      </div>
      <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/10 p-3 text-xs leading-5 text-amber-200">Administrator access includes account creation, settings and all business records. Assign it only to trusted owners.</div>
      {(formError || create.error) && <p className="mt-5 rounded-xl bg-red-400/10 p-3 text-sm text-red-300" role="alert">{formError || create.error?.message}</p>}
      <div className="mt-6 flex justify-end gap-3 border-t border-line pt-5"><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create team account'}</Button></div>
    </form></div>}
  </>
}
