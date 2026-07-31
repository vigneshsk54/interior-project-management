import {
  ArrowRight, BarChart3, BriefcaseBusiness, Building2, Check, CheckCircle2,
  ClipboardCheck, FileText, HardHat, Layers3, Menu, PackageCheck, Palette,
  ShieldCheck, Sparkles, UsersRound, WalletCards, X, Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

const workflow = [
  { icon: UsersRound, number: '01', title: 'Customer enquiry', copy: 'Clients sign up and share their property, location, budget and design requirements.' },
  { icon: ClipboardCheck, number: '02', title: 'Sales qualification', copy: 'The studio tracks calls, follow-ups, site visits and the complete requirement brief.' },
  { icon: FileText, number: '03', title: 'Quotation & approval', copy: 'Build room-wise estimates with rates, tax and margin, then manage revisions and approval.' },
  { icon: BriefcaseBusiness, number: '04', title: 'Project setup', copy: 'An approved quotation becomes a structured project with milestones, tasks and ownership.' },
  { icon: Palette, number: '05', title: 'Design collaboration', copy: 'Share designs and documents, request feedback and keep every approval traceable.' },
  { icon: HardHat, number: '06', title: 'Site execution', copy: 'Coordinate schedules, daily work, site reports, blockers and team responsibilities.' },
  { icon: PackageCheck, number: '07', title: 'Procurement & vendors', copy: 'Track materials, work orders, delivery commitments and vendor performance.' },
  { icon: WalletCards, number: '08', title: 'Payments & handover', copy: 'Monitor budgets, collections, outstanding payments and final project closure.' },
]

const capabilities = [
  { icon: UsersRound, title: 'CRM & enquiries', copy: 'A searchable sales pipeline for every lead, customer, follow-up and site visit.' },
  { icon: FileText, title: 'Smart quotations', copy: 'Versioned, room-wise quotations with quantities, tax, margins and approval history.' },
  { icon: BriefcaseBusiness, title: 'Project delivery', copy: 'Milestones, dependencies, progress, health indicators and deadline management.' },
  { icon: ClipboardCheck, title: 'Tasks & teams', copy: 'Role-based work queues for designers, project managers and site supervisors.' },
  { icon: Palette, title: 'Design approvals', copy: 'Centralized design reviews so feedback and client decisions never get lost.' },
  { icon: PackageCheck, title: 'Procurement', copy: 'Materials, vendors, orders, delivery status and on-site availability in one view.' },
  { icon: WalletCards, title: 'Commercial control', copy: 'Budgets, payment milestones, outstanding balances and revenue reporting.' },
  { icon: BarChart3, title: 'Business reporting', copy: 'Live visibility into pipeline, conversion, project risk, workload and collections.' },
]

const roles = [
  ['Admin', 'Workspace access, people, roles and complete operational visibility.'],
  ['Sales manager', 'Enquiries, customers, site visits and quotation conversion.'],
  ['Interior designer', 'Design tasks, documents, reviews and client approvals.'],
  ['Project manager', 'Delivery plans, teams, procurement, budgets and vendors.'],
  ['Site supervisor', 'Daily execution, tasks, materials and site progress reports.'],
  ['Client', 'Project requests, progress, designs, decisions and notifications.'],
  ['Vendor', 'Assigned work orders, commitments, delivery status and updates.'],
]

const benefits = [
  'One source of truth from enquiry to handover',
  'Clear ownership and deadline visibility',
  'Faster client decisions and approvals',
  'Less spreadsheet and WhatsApp dependency',
  'Role-based access for every participant',
  'Automated operational reminders',
]

export function Home() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return <div className="min-h-screen overflow-hidden bg-app text-content">
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-app/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Atelier Flow home">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-light shadow-[0_10px_28px_rgba(124,92,255,.3)]"><Layers3 className="h-5 w-5" /></span>
          <span><span className="block text-sm font-semibold sm:text-base">Atelier Flow</span><span className="block text-[9px] uppercase tracking-[.18em] text-content-muted">Interior operations</span></span>
        </Link>
        <nav className="ml-auto hidden items-center gap-7 md:flex" aria-label="Primary navigation">
          <a className="text-sm text-content-secondary transition hover:text-white" href="#workflow">How it works</a>
          <a className="text-sm text-content-secondary transition hover:text-white" href="#features">Features</a>
          <a className="text-sm text-content-secondary transition hover:text-white" href="#roles">Who it’s for</a>
          <Link className="btn-secondary" to="/login/client">Log in</Link>
          <Link className="btn-primary" to="/signup">Start a project</Link>
        </nav>
        <button className="icon-btn ml-auto md:hidden" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
      </div>
      {mobileOpen && <div className="border-t border-line bg-subtle p-4 md:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-2">
          <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.16em] text-content-muted">Navigate</p><button className="icon-btn h-9 w-9" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X className="h-4 w-4" /></button></div>
          <a className="rounded-xl px-3 py-3 text-sm text-content-secondary hover:bg-white/[.05] hover:text-white" href="#workflow" onClick={() => setMobileOpen(false)}>How it works</a>
          <a className="rounded-xl px-3 py-3 text-sm text-content-secondary hover:bg-white/[.05] hover:text-white" href="#features" onClick={() => setMobileOpen(false)}>Features</a>
          <a className="rounded-xl px-3 py-3 text-sm text-content-secondary hover:bg-white/[.05] hover:text-white" href="#roles" onClick={() => setMobileOpen(false)}>Who it’s for</a>
          <div className="mt-2 grid grid-cols-2 gap-3"><Link className="btn-secondary" to="/login/client">Log in</Link><Link className="btn-primary" to="/signup">Sign up</Link></div>
        </div>
      </div>}
    </header>

    <main>
      <section className="relative px-4 pb-20 pt-32 sm:px-6 sm:pb-28 sm:pt-40 lg:px-8">
        <div className="absolute left-1/2 top-0 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-brand/10 blur-[140px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.02fr_.98fr] lg:gap-16">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand-light"><Sparkles className="h-3.5 w-3.5" />Built for interior studios and their clients</div>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-.045em] sm:text-5xl lg:mx-0 lg:text-[64px]">Every interior project, <span className="bg-gradient-to-r from-brand-light to-white bg-clip-text text-transparent">beautifully organized.</span></h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-content-secondary sm:text-lg sm:leading-8 lg:mx-0">Atelier Flow connects enquiries, quotations, design approvals, site execution, procurement and payments in one calm workspace—from the first conversation to the final handover.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link className="btn-primary h-12 px-6" to="/signup">Start your project<ArrowRight className="h-4 w-4" /></Link>
              <Link className="btn-secondary h-12 px-6" to="/login/admin">Open your workspace</Link>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs text-content-secondary lg:justify-start">
              {['Client portal', 'Role-based workspace', 'Automated reminders'].map((item) => <span className="flex items-center gap-2" key={item}><CheckCircle2 className="h-4 w-4 text-emerald-300" />{item}</span>)}
            </div>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section className="border-y border-line bg-subtle/55 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 text-center sm:grid-cols-3">
          <div><p className="text-2xl font-semibold text-white sm:text-3xl">8</p><p className="mt-1 text-xs uppercase tracking-[.14em] text-content-muted">Connected project stages</p></div>
          <div className="border-line sm:border-x"><p className="text-2xl font-semibold text-white sm:text-3xl">7</p><p className="mt-1 text-xs uppercase tracking-[.14em] text-content-muted">Purpose-built user roles</p></div>
          <div><p className="text-2xl font-semibold text-white sm:text-3xl">1</p><p className="mt-1 text-xs uppercase tracking-[.14em] text-content-muted">Operational source of truth</p></div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <SectionIntro eyebrow="Complete workflow" title="From first enquiry to final handover" copy="Each stage feeds the next, giving the studio and client a shared, reliable picture of progress." />
        <div className="mx-auto mt-12 grid max-w-7xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {workflow.map(({ icon: Icon, number, title, copy }) => <article className="surface group relative overflow-hidden p-5 sm:p-6" key={number}>
            <span className="absolute right-4 top-3 text-4xl font-bold text-white/[.035]">{number}</span>
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-brand/20 bg-brand/10 text-brand-light transition group-hover:border-brand/40 group-hover:bg-brand/15"><Icon className="h-5 w-5" /></span>
            <h3 className="mt-5 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-content-secondary">{copy}</p>
          </article>)}
        </div>
      </section>

      <section id="features" className="scroll-mt-20 border-y border-line bg-subtle/55 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <SectionIntro eyebrow="One connected system" title="Everything your studio needs to deliver well" copy="Replace fragmented spreadsheets, message threads and disconnected documents with structured, role-aware operations." />
        <div className="mx-auto mt-12 grid max-w-7xl gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map(({ icon: Icon, title, copy }) => <article className="bg-panel p-6 sm:min-h-[220px]" key={title}>
            <Icon className="h-6 w-6 text-brand-light" />
            <h3 className="mt-5 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-content-secondary">{copy}</p>
          </article>)}
        </div>
      </section>

      <section id="roles" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-light">The right view for everyone</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">One workflow. Seven focused experiences.</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-content-secondary sm:text-base">Every participant sees the work and decisions relevant to them, while sensitive commercial and administrative data stays protected.</p>
            <div className="mt-7 space-y-3">{benefits.map((benefit) => <p className="flex items-start gap-3 text-sm text-content-secondary" key={benefit}><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/10"><Check className="h-3 w-3 text-emerald-300" /></span>{benefit}</p>)}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map(([role, copy], index) => <article className={`surface p-5 ${index === roles.length - 1 ? 'sm:col-span-2' : ''}`} key={role}>
              <div className="flex items-start gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.045] text-sm font-bold text-brand-light">{String(index + 1).padStart(2, '0')}</span><div><h3 className="font-semibold">{role}</h3><p className="mt-1.5 text-sm leading-6 text-content-secondary">{copy}</p></div></div>
            </article>)}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] border border-brand/25 bg-gradient-to-br from-brand/20 via-panel to-panel p-7 sm:p-12 lg:p-16">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full border border-brand/20" />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_.75fr] lg:items-center">
            <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-brand-light"><Zap className="h-4 w-4" />Connected and secure</div><h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Run the studio with clarity. Keep clients confidently informed.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-content-secondary sm:text-base">Automated reminders keep deadlines, payments and approvals moving. Role-based permissions, secure authentication and audit trails protect the operational record.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end"><Link className="btn-primary h-12 px-6" to="/signup">Create client account</Link><Link className="btn-secondary h-12 px-6" to="/login/client">Client login</Link></div>
          </div>
        </div>
      </section>
    </main>

    <footer className="border-t border-line px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex items-center justify-center gap-3 sm:justify-start"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-light"><Layers3 className="h-4 w-4" /></span><div><p className="text-sm font-semibold">Atelier Flow</p><p className="text-xs text-content-muted">Considered interiors. Organized delivery.</p></div></div>
        <p className="text-xs text-content-muted">© 2026 Atelier Flow. Interior project operations.</p>
      </div>
    </footer>
  </div>
}

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-brand-light">{eyebrow}</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">{title}</h2><p className="mt-4 text-sm leading-7 text-content-secondary sm:text-base">{copy}</p></div>
}

function ProductPreview() {
  return <div className="relative mx-auto w-full max-w-[590px]">
    <div className="absolute -inset-6 rounded-[32px] bg-brand/10 blur-3xl" />
    <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0e1528] p-3 shadow-[0_32px_100px_rgba(0,0,0,.45)] sm:p-4">
      <div className="flex items-center gap-2 border-b border-line pb-3"><span className="h-2.5 w-2.5 rounded-full bg-red-300/70" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300/70" /><span className="ml-2 text-[10px] text-content-muted">Studio overview</span></div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[['Active projects', '12', '+2 this month'], ['Pipeline value', '₹1.8Cr', '18 enquiries'], ['On-time tasks', '91%', '124 completed']].map(([label, value, note], index) => <div className={`rounded-xl border border-line bg-white/[.035] p-3 ${index === 2 ? 'col-span-2 sm:col-span-1' : ''}`} key={label}><p className="text-[9px] text-content-muted">{label}</p><p className="mt-2 text-lg font-semibold sm:text-xl">{value}</p><p className="mt-1 text-[9px] text-emerald-300">{note}</p></div>)}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1.3fr_.7fr]">
        <div className="rounded-xl border border-line bg-white/[.035] p-4">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold">Project health</p><span className="text-[9px] text-brand-light">View all</span></div>
          <div className="mt-4 space-y-4">{[['Iyer Residence', 'Design development', 68], ['Lumen Penthouse', 'Site execution', 42], ['Terra Café', 'Procurement', 81]].map(([name, stage, progress]) => <div key={String(name)}><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate text-[10px] font-semibold">{name}</p><p className="mt-0.5 truncate text-[9px] text-content-muted">{stage}</p></div><span className="text-[9px] font-semibold">{progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light" style={{ width: `${progress}%` }} /></div></div>)}</div>
        </div>
        <div className="rounded-xl border border-line bg-white/[.035] p-4"><p className="text-xs font-semibold">Today</p><div className="mt-4 space-y-3">{['Design review', 'Site measurement', 'Vendor follow-up', 'Client approval'].map((item, index) => <div className="flex items-center gap-2" key={item}><span className={`h-2 w-2 rounded-full ${index < 2 ? 'bg-brand-light' : 'bg-white/20'}`} /><span className="text-[9px] text-content-secondary">{item}</span></div>)}</div></div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-brand/15 bg-brand/10 p-3"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-light" /><p className="text-[9px] text-content-secondary">Approvals, tasks and payments connected</p></div><Building2 className="h-4 w-4 text-content-muted" /></div>
    </div>
  </div>
}
