import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, BriefcaseBusiness, Eye, EyeOff, House, Layers3, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { emailSchema, lowercaseEmailInput, normalizeEmailCase, phoneSchema } from '../lib/validation'

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(12, 'Password must be at least 12 characters'),
})
type LoginFormData = z.infer<typeof loginSchema>

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name'),
  email: emailSchema,
  phone: phoneSchema,
  password: z.string().min(12, 'Password must be at least 12 characters'),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type SignupFormData = z.infer<typeof signupSchema>

function BrandArtwork() {
  return <section className="relative hidden overflow-hidden border-r border-line bg-subtle p-12 text-white lg:flex lg:flex-col">
    <div className="absolute -right-36 -top-36 h-96 w-96 rounded-full border border-brand/20 bg-brand/5" />
    <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full border border-brand-light/20 bg-brand/5" />
    <div className="absolute bottom-0 left-0 h-72 w-72 -translate-x-1/2 translate-y-1/2 rounded-full bg-brand/10 blur-3xl" />
    <Brand />
    <div className="relative my-auto max-w-lg">
      <p className="mb-6 text-4xl font-semibold leading-[1.18] tracking-[-0.035em]">Every beautiful space begins with an organized process.</p>
      <p className="max-w-md text-base leading-7 text-content-secondary">Bring enquiries, design approvals, site execution, procurement and payments into one calm, connected workspace.</p>
    </div>
    <p className="relative text-xs text-content-muted">© 2026 Atelier Flow. Built for considered interiors.</p>
  </section>
}

function Brand() {
  return <div className="relative flex items-center gap-3">
    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-white shadow-[0_10px_30px_rgba(124,92,255,.28)]"><Layers3 className="h-5 w-5" /></div>
    <div><p className="font-semibold">Atelier Flow</p><p className="text-[10px] uppercase tracking-[.18em] text-content-muted">Project operations</p></div>
  </div>
}

type LoginMode = 'client' | 'workspace'

export function Login({ mode = 'client' }: { mode?: LoginMode }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const submit = handleSubmit(async (values) => {
    setServerError('')
    try {
      const user = await login(values.email, values.password, mode)
      const destination = user.role === 'client' ? '/client-portal' : user.role === 'vendor' ? '/vendor-portal' : (location.state as { from?: string } | null)?.from || '/dashboard'
      navigate(destination, { replace: true })
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Log in failed')
    }
  })

  return <main className="grid min-h-screen bg-app lg:grid-cols-[1.05fr_.95fr]">
    <BrandArtwork />
    <section className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
      <div className="surface w-full max-w-[460px] p-6 sm:p-9">
        <div className="mb-10 lg:hidden"><Brand /></div>
        <div className="mb-7 grid grid-cols-2 gap-1 rounded-xl border border-line bg-subtle p-1" aria-label="Choose login type">
          <Link to="/login/client" aria-current={mode === 'client' ? 'page' : undefined} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${mode === 'client' ? 'bg-brand/15 text-white ring-1 ring-inset ring-brand/25' : 'text-content-muted hover:text-white'}`}><House className="h-4 w-4" />Client</Link>
          <Link to="/login/admin" aria-current={mode === 'workspace' ? 'page' : undefined} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${mode === 'workspace' ? 'bg-brand/15 text-white ring-1 ring-inset ring-brand/25' : 'text-content-muted hover:text-white'}`}><ShieldCheck className="h-4 w-4" />Admin / Team</Link>
        </div>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-brand">{mode === 'client' ? <House className="h-4 w-4" /> : <BriefcaseBusiness className="h-4 w-4" />}{mode === 'client' ? 'Client access' : 'Studio access'}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{mode === 'client' ? 'Log in to your client portal' : 'Log in to the studio workspace'}</h1>
        <p className="mt-2 text-sm leading-6 text-content-secondary">{mode === 'client' ? 'Follow your projects, submit requests and make design decisions.' : 'Manage enquiries, quotations, projects, teams and operations.'}</p>
        <form className="mt-8 space-y-5" noValidate onSubmit={submit}>
          <div><label className="label" htmlFor="email">Email address</label><input id="email" className="input" type="email" autoCapitalize="none" autoComplete="email" onInput={lowercaseEmailInput} {...register('email')} />{errors.email && <p className="mt-1 text-xs text-red-300">{errors.email.message}</p>}</div>
          <div><div className="flex items-center justify-between"><label className="label" htmlFor="password">Password</label><Link className="mb-1.5 text-xs font-semibold text-brand" to="/forgot-password">Forgot password?</Link></div><div className="relative"><input id="password" className="input pr-11" type={showPassword ? 'text' : 'password'} autoComplete="current-password" {...register('password')} /><button type="button" className="absolute right-3 top-2.5 text-content-muted" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>{errors.password && <p className="mt-1 text-xs text-red-300">{errors.password.message}</p>}</div>
          {serverError && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{serverError}</p>}
          <button disabled={isSubmitting} className="btn-primary w-full">{isSubmitting ? 'Logging in…' : mode === 'client' ? 'Log in as client' : 'Log in to workspace'}<ArrowRight className="h-4 w-4" /></button>
        </form>
        {mode === 'client'
          ? <p className="mt-7 text-center text-sm text-content-secondary">New client? <Link className="font-semibold text-brand-light hover:text-white" to="/signup">Create an account</Link></p>
          : <p className="mt-7 text-center text-sm text-content-secondary">Are you a client? <Link className="font-semibold text-brand-light hover:text-white" to="/login/client">Use client login</Link></p>}
      </div>
    </section>
  </main>
}

export function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' },
  })
  const submit = handleSubmit(async (values) => {
    setServerError('')
    try {
      await signup(values.fullName, values.email, values.phone, values.password)
      navigate('/client-portal', { replace: true })
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Sign up failed')
    }
  })

  return <main className="grid min-h-screen bg-app lg:grid-cols-[1.05fr_.95fr]">
    <BrandArtwork />
    <section className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
      <div className="surface w-full max-w-[520px] p-6 sm:p-9">
        <div className="mb-8 lg:hidden"><Brand /></div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">Get started</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-content-secondary">Set up your client portal to follow projects and approvals.</p>
        <form className="mt-7 space-y-4" noValidate onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="full-name">Full name</label><input id="full-name" className="input" autoComplete="name" {...register('fullName')} />{errors.fullName && <p className="mt-1 text-xs text-red-300">{errors.fullName.message}</p>}</div>
            <div><label className="label" htmlFor="phone">Phone number</label><input id="phone" className="input" type="tel" inputMode="numeric" minLength={10} maxLength={10} autoComplete="tel" {...register('phone')} />{errors.phone && <p className="mt-1 text-xs text-red-300">{errors.phone.message}</p>}</div>
          </div>
          <div><label className="label" htmlFor="signup-email">Email address</label><input id="signup-email" className="input" type="email" autoCapitalize="none" autoComplete="email" onInput={lowercaseEmailInput} {...register('email')} />{errors.email && <p className="mt-1 text-xs text-red-300">{errors.email.message}</p>}</div>
          <div><label className="label" htmlFor="signup-password">Password</label><div className="relative"><input id="signup-password" className="input pr-11" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('password')} /><button type="button" className="absolute right-3 top-2.5 text-content-muted" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle sign-up password visibility">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>{errors.password && <p className="mt-1 text-xs text-red-300">{errors.password.message}</p>}</div>
          <div><label className="label" htmlFor="confirm-password">Confirm password</label><input id="confirm-password" className="input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('confirmPassword')} />{errors.confirmPassword && <p className="mt-1 text-xs text-red-300">{errors.confirmPassword.message}</p>}</div>
          {serverError && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{serverError}</p>}
          <button disabled={isSubmitting} className="btn-primary mt-1 w-full">{isSubmitting ? 'Creating account…' : 'Sign up'}<ArrowRight className="h-4 w-4" /></button>
        </form>
        <p className="mt-6 text-center text-sm text-content-secondary">Already have an account? <Link className="font-semibold text-brand-light hover:text-white" to="/login/client">Client login</Link></p>
      </div>
    </section>
  </main>
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
      setSent(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit request')
    }
  }
  return <main className="grid min-h-screen place-items-center bg-app p-5"><section className="surface w-full max-w-md p-7 sm:p-9"><div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-white shadow-[0_10px_30px_rgba(124,92,255,.24)]"><Layers3 className="h-5 w-5" /></div><h1 className="mt-7 text-2xl font-semibold tracking-tight">Reset your password</h1>{sent ? <p className="mt-3 text-sm leading-6 text-content-secondary">If that email belongs to an account, password reset instructions are on their way.</p> : <><p className="mt-2 text-sm text-content-secondary">Enter your account email and we’ll send a secure reset link.</p><form onSubmit={submit} className="mt-7"><label className="label" htmlFor="reset-email">Email address</label><input id="reset-email" className="input" type="email" autoCapitalize="none" autoComplete="email" required value={email} onChange={(event) => setEmail(normalizeEmailCase(event.target.value))} />{error && <p className="mt-3 text-sm text-red-300">{error}</p>}<button className="btn-primary mt-5 w-full">Send reset link</button></form></>}<Link to="/login/client" className="mt-6 inline-block text-sm font-semibold text-brand-light hover:text-white">Back to log in</Link></section></main>
}
