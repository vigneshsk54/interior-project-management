import { AlertCircle, Inbox, LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'
import { humanize } from '../lib/api'

type CardVariant = 'default' | 'elevated' | 'interactive' | 'statistic' | 'chart' | 'form' | 'compact'

export function Card({ children, className = '', variant = 'default' }: { children: ReactNode; className?: string; variant?: CardVariant }) {
  return <section className={clsx(
    'surface',
    variant === 'interactive' && 'surface-interactive',
    variant === 'elevated' && 'shadow-elevated',
    variant === 'statistic' && 'min-h-[132px]',
    variant === 'chart' && 'min-w-0 overflow-hidden',
    variant === 'form' && 'p-5 sm:p-6',
    variant === 'compact' && 'rounded-2xl',
    className,
  )}>{children}</section>
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'icon'

export function Button({ className, variant = 'primary', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={clsx(
    variant === 'primary' && 'btn-primary',
    variant === 'secondary' && 'btn-secondary',
    variant === 'outline' && 'btn-outline',
    variant === 'ghost' && 'btn-ghost',
    variant === 'danger' && 'btn-danger',
    variant === 'icon' && 'icon-btn',
    className,
  )} {...props} />
}

const badgeStyles: Record<string, string> = {
  won: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20', approved: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20',
  completed: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20', on_track: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20',
  new: 'bg-blue-400/10 text-blue-300 ring-blue-400/20', sent: 'bg-blue-400/10 text-blue-300 ring-blue-400/20', in_progress: 'bg-blue-400/10 text-blue-300 ring-blue-400/20',
  at_risk: 'bg-amber-400/10 text-amber-300 ring-amber-400/20', pending: 'bg-amber-400/10 text-amber-300 ring-amber-400/20',
  pending_approval: 'bg-amber-400/10 text-amber-300 ring-amber-400/20', negotiation: 'bg-brand/10 text-brand-light ring-brand/20',
  critical: 'bg-red-400/10 text-red-300 ring-red-400/20', blocked: 'bg-red-400/10 text-red-300 ring-red-400/20', overdue: 'bg-red-400/10 text-red-300 ring-red-400/20',
  lost: 'bg-white/[0.06] text-content-secondary ring-white/10', draft: 'bg-white/[0.06] text-content-secondary ring-white/10',
}

export function Badge({ value }: { value: string }) {
  return <span className={clsx('inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset', badgeStyles[value] || 'bg-brand/10 text-brand-light ring-brand/20')}>{humanize(value)}</span>
}

export function Loading({ label = 'Loading workspace…' }: { label?: string }) {
  return <div className="flex min-h-[240px] items-center justify-center gap-3 text-sm text-content-secondary" role="status"><LoaderCircle className="h-5 w-5 animate-spin text-brand-light" />{label}</div>
}

export function Empty({ title = 'Nothing here yet', message = 'New records will appear here.' }: { title?: string; message?: string }) {
  return <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center"><div className="mb-4 rounded-2xl border border-brand/20 bg-brand/10 p-3"><Inbox className="h-6 w-6 text-brand-light" /></div><p className="font-semibold">{title}</p><p className="mt-1 max-w-sm text-sm text-content-secondary">{message}</p></div>
}

export function ErrorState({ error }: { error: Error }) {
  return <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center" role="alert"><AlertCircle className="mb-3 h-7 w-7 text-red-300" /><p className="font-semibold">We couldn't load this view</p><p className="mt-1 max-w-md text-sm text-content-secondary">{error.message}</p></div>
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="mb-6 flex flex-col justify-between gap-4 border-b border-line pb-6 sm:mb-7 sm:flex-row sm:items-end"><div className="min-w-0">{eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-brand-light">{eyebrow}</p>}<h1 className="text-2xl font-semibold tracking-[-0.025em] text-content sm:text-[28px]">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-content-secondary">{description}</p>}</div>{action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}</header>
}

export function Progress({ value }: { value: number }) {
  const bounded = Math.min(100, Math.max(0, value))
  return <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bounded}><div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-all duration-500" style={{ width: `${bounded}%` }} /></div>
}

export function StatCard({ label, value, note, icon: Icon, className }: { label: string; value: ReactNode; note?: ReactNode; icon: LucideIcon; className?: string }) {
  return <Card variant="statistic" className={clsx('flex h-full flex-col p-5', className)}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm text-content-secondary">{label}</p><p className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-content">{value}</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/20 bg-brand/10 text-brand-light"><Icon className="h-5 w-5" /></span></div>{note && <p className="mt-auto pt-4 text-xs leading-5 text-content-muted">{note}</p>}</Card>
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5 sm:px-6"><div><h2 className="section-title">{title}</h2>{description && <p className="section-copy">{description}</p>}</div>{action}</div>
}
