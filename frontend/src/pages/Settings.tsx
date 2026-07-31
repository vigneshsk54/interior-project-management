import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell, Bot, Building2, CheckCircle2, FolderKanban, Link2, Palette,
  Save, Settings as SettingsIcon, ShieldCheck, Users,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { normalizeEmailCase } from '../lib/validation'
import { Button, Card, ErrorState, Loading, PageHeader } from '../components/ui'

interface SettingItem {
  id: string
  key: string
  value: Record<string, unknown>
}

interface CompanyProfile {
  studioName: string
  legalName: string
  email: string
  phone: string
  website: string
  taxId: string
  address: string
}
interface Branding {
  displayName: string
  tagline: string
  primaryColor: string
  logoUrl: string
}
interface ProjectDefaults {
  currency: string
  taxRate: string
  quotationValidityDays: string
  stages: string
}
interface NotificationSettings {
  emailEnabled: boolean
  deadlineReminders: boolean
  paymentReminders: boolean
  approvalReminders: boolean
  reminderDays: string
}
interface AutomationSettings {
  enabled: boolean
  enquiryWorkflow: boolean
  deadlineWorkflow: boolean
  paymentWorkflow: boolean
  webhookUrl: string
}

const defaults = {
  company: {
    studioName: 'Atelier Flow',
    legalName: '',
    email: '',
    phone: '',
    website: '',
    taxId: '',
    address: '',
  } satisfies CompanyProfile,
  branding: {
    displayName: 'Atelier Flow',
    tagline: 'Considered interiors. Organized delivery.',
    primaryColor: '#7c5cff',
    logoUrl: '',
  } satisfies Branding,
  projects: {
    currency: 'INR',
    taxRate: '18',
    quotationValidityDays: '15',
    stages: 'Planning, Design, Procurement, Execution, Handover',
  } satisfies ProjectDefaults,
  notifications: {
    emailEnabled: true,
    deadlineReminders: true,
    paymentReminders: true,
    approvalReminders: true,
    reminderDays: '3',
  } satisfies NotificationSettings,
  automation: {
    enabled: true,
    enquiryWorkflow: true,
    deadlineWorkflow: true,
    paymentWorkflow: true,
    webhookUrl: '',
  } satisfies AutomationSettings,
}

type Section = 'company' | 'branding' | 'projects' | 'notifications' | 'automation' | 'access'

const sections: { key: Section; label: string; description: string; icon: typeof Building2 }[] = [
  { key: 'company', label: 'Company profile', description: 'Studio and billing identity', icon: Building2 },
  { key: 'branding', label: 'Branding', description: 'Name, logo and appearance', icon: Palette },
  { key: 'projects', label: 'Project defaults', description: 'Stages, tax and quotations', icon: FolderKanban },
  { key: 'notifications', label: 'Notifications', description: 'Email and reminder preferences', icon: Bell },
  { key: 'automation', label: 'Automations', description: 'Workflow and webhook controls', icon: Bot },
  { key: 'access', label: 'Users & access', description: 'Accounts and permissions', icon: Users },
]

export function SettingsPage() {
  const client = useQueryClient()
  const [active, setActive] = useState<Section>('company')
  const [savedKey, setSavedKey] = useState('')
  const [company, setCompany] = useState<CompanyProfile>(defaults.company)
  const [branding, setBranding] = useState<Branding>(defaults.branding)
  const [projects, setProjects] = useState<ProjectDefaults>(defaults.projects)
  const [notifications, setNotifications] = useState<NotificationSettings>(defaults.notifications)
  const [automation, setAutomation] = useState<AutomationSettings>(defaults.automation)
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<SettingItem[]>('/settings/list'),
  })

  useEffect(() => {
    if (!query.data) return
    const value = (key: string) => query.data.find((item) => item.key === key)?.value || {}
    const companyValue = value('company_profile') as Partial<CompanyProfile>
    const brandingValue = value('branding') as Partial<Branding>
    const projectValue = value('project_defaults') as Partial<ProjectDefaults> & { stages?: unknown }
    const notificationValue = value('notifications') as Partial<NotificationSettings>
    const automationValue = value('n8n') as Partial<AutomationSettings>
    setCompany({ ...defaults.company, ...companyValue })
    setBranding({ ...defaults.branding, ...brandingValue })
    setProjects({
      ...defaults.projects,
      ...projectValue,
      stages: Array.isArray(projectValue.stages) ? projectValue.stages.join(', ') : String(projectValue.stages || defaults.projects.stages),
    })
    setNotifications({ ...defaults.notifications, ...notificationValue })
    setAutomation({ ...defaults.automation, ...automationValue })
  }, [query.data])

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: Record<string, unknown> }) =>
      api<SettingItem>(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
    onSuccess: (_, variables) => {
      setSavedKey(variables.key)
      client.invalidateQueries({ queryKey: ['settings'] })
    },
  })
  const saveSection = (key: string, value: Record<string, unknown>) => {
    setSavedKey('')
    save.mutate({ key, value })
  }
  const saveButton = (key: string, value: Record<string, unknown>) =>
    <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
      <div>{savedKey === key && <p role="status" className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />Changes saved</p>}{save.error && save.variables?.key === key && <p role="alert" className="text-sm text-red-300">{save.error.message}</p>}</div>
      <Button onClick={() => saveSection(key, value)} disabled={save.isPending && save.variables?.key === key}><Save className="h-4 w-4" />{save.isPending && save.variables?.key === key ? 'Saving…' : 'Save changes'}</Button>
    </div>

  if (query.isLoading) return <Loading />
  if (query.error) return <ErrorState error={query.error} />

  return <>
    <PageHeader eyebrow="Administration" title="Settings" description="Configure your studio profile, project defaults, communication and connected workflows." />
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card className="h-fit overflow-x-auto p-2 lg:sticky lg:top-[98px] lg:overflow-visible">
        <nav className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col" aria-label="Settings sections">
          {sections.map(({ key, label, description, icon: Icon }) => <button key={key} onClick={() => setActive(key)} className={`flex min-w-[190px] items-center gap-3 rounded-xl p-3 text-left transition lg:min-w-0 ${active === key ? 'bg-brand/15 text-white ring-1 ring-inset ring-brand/20' : 'text-content-secondary hover:bg-white/[.05] hover:text-white'}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${active === key ? 'bg-brand/15 text-brand-light' : 'bg-white/[.04] text-content-muted'}`}><Icon className="h-4 w-4" /></span>
            <span><span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 hidden text-[11px] text-content-muted lg:block">{description}</span></span>
          </button>)}
        </nav>
      </Card>

      <div className="min-w-0">
        {active === 'company' && <SettingsCard icon={Building2} title="Company profile" copy="Details used across quotations, documents and client communication.">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Studio name" value={company.studioName} onChange={(studioName) => setCompany({ ...company, studioName })} />
            <TextField label="Legal business name" value={company.legalName} onChange={(legalName) => setCompany({ ...company, legalName })} />
            <TextField label="Business email" type="email" value={company.email} onChange={(email) => setCompany({ ...company, email })} />
            <TextField label="Phone number" type="tel" value={company.phone} onChange={(phone) => setCompany({ ...company, phone })} />
            <TextField label="Website" type="url" value={company.website} onChange={(website) => setCompany({ ...company, website })} />
            <TextField label="GST / Tax ID" value={company.taxId} onChange={(taxId) => setCompany({ ...company, taxId })} />
            <label className="sm:col-span-2"><span className="label">Office address</span><textarea className="input min-h-24 py-3" value={company.address} onChange={(event) => setCompany({ ...company, address: event.target.value })} /></label>
          </div>
          {saveButton('company_profile', { ...company })}
        </SettingsCard>}

        {active === 'branding' && <SettingsCard icon={Palette} title="Branding" copy="Control how the workspace and client-facing communication identify your studio.">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Display name" value={branding.displayName} onChange={(displayName) => setBranding({ ...branding, displayName })} />
            <TextField label="Tagline" value={branding.tagline} onChange={(tagline) => setBranding({ ...branding, tagline })} />
            <label><span className="label">Primary color</span><div className="flex gap-2"><input aria-label="Primary color picker" className="h-11 w-14 rounded-xl border border-line bg-subtle p-1" type="color" value={branding.primaryColor} onChange={(event) => setBranding({ ...branding, primaryColor: event.target.value })} /><input aria-label="Primary color value" className="input font-mono" value={branding.primaryColor} onChange={(event) => setBranding({ ...branding, primaryColor: event.target.value })} /></div></label>
            <TextField label="Logo URL" type="url" value={branding.logoUrl} onChange={(logoUrl) => setBranding({ ...branding, logoUrl })} />
          </div>
          <div className="rounded-xl border border-line bg-subtle p-4"><p className="text-xs font-semibold text-content-muted">Preview</p><div className="mt-3 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: branding.primaryColor }}>AF</span><div><p className="font-semibold">{branding.displayName || 'Studio name'}</p><p className="text-xs text-content-secondary">{branding.tagline || 'Studio tagline'}</p></div></div></div>
          {saveButton('branding', { ...branding })}
        </SettingsCard>}

        {active === 'projects' && <SettingsCard icon={FolderKanban} title="Project defaults" copy="Set the commercial and delivery defaults used when records are created.">
          <div className="grid gap-5 sm:grid-cols-2">
            <label><span className="label">Currency</span><select className="input" value={projects.currency} onChange={(event) => setProjects({ ...projects, currency: event.target.value })}><option value="INR">INR — Indian Rupee</option><option value="USD">USD — US Dollar</option><option value="AED">AED — UAE Dirham</option><option value="GBP">GBP — British Pound</option></select></label>
            <TextField label="Default tax rate (%)" type="number" value={projects.taxRate} onChange={(taxRate) => setProjects({ ...projects, taxRate })} />
            <TextField label="Quotation validity (days)" type="number" value={projects.quotationValidityDays} onChange={(quotationValidityDays) => setProjects({ ...projects, quotationValidityDays })} />
            <label className="sm:col-span-2"><span className="label">Default project stages</span><textarea className="input min-h-24 py-3" value={projects.stages} onChange={(event) => setProjects({ ...projects, stages: event.target.value })} /><span className="mt-1 block text-xs text-content-muted">Separate stages with commas.</span></label>
          </div>
          {saveButton('project_defaults', { ...projects, stages: projects.stages.split(',').map((stage) => stage.trim()).filter(Boolean) })}
        </SettingsCard>}

        {active === 'notifications' && <SettingsCard icon={Bell} title="Notifications" copy="Choose when the team receives operational reminders and alerts.">
          <div className="divide-y divide-line rounded-xl border border-line">
            <Toggle label="Email notifications" copy="Send important workspace updates by email." checked={notifications.emailEnabled} onChange={(emailEnabled) => setNotifications({ ...notifications, emailEnabled })} />
            <Toggle label="Deadline reminders" copy="Notify assignees about tasks approaching their due date." checked={notifications.deadlineReminders} onChange={(deadlineReminders) => setNotifications({ ...notifications, deadlineReminders })} />
            <Toggle label="Payment reminders" copy="Notify the team about upcoming and overdue collections." checked={notifications.paymentReminders} onChange={(paymentReminders) => setNotifications({ ...notifications, paymentReminders })} />
            <Toggle label="Approval reminders" copy="Follow up when client design decisions are pending." checked={notifications.approvalReminders} onChange={(approvalReminders) => setNotifications({ ...notifications, approvalReminders })} />
          </div>
          <div className="max-w-xs"><TextField label="Remind before (days)" type="number" value={notifications.reminderDays} onChange={(reminderDays) => setNotifications({ ...notifications, reminderDays })} /></div>
          {saveButton('notifications', { ...notifications })}
        </SettingsCard>}

        {active === 'automation' && <SettingsCard icon={Bot} title="Workflow automations" copy="Control background workflows that keep enquiries, deadlines and payments moving.">
          <div className="divide-y divide-line rounded-xl border border-line">
            <Toggle label="Enable automations" copy="Allow configured n8n workflows to process operational events." checked={automation.enabled} onChange={(enabled) => setAutomation({ ...automation, enabled })} />
            <Toggle label="New enquiry workflow" copy="Queue acknowledgements and team notifications for new enquiries." checked={automation.enquiryWorkflow} onChange={(enquiryWorkflow) => setAutomation({ ...automation, enquiryWorkflow })} />
            <Toggle label="Deadline workflow" copy="Send task deadline reminders to responsible team members." checked={automation.deadlineWorkflow} onChange={(deadlineWorkflow) => setAutomation({ ...automation, deadlineWorkflow })} />
            <Toggle label="Payment workflow" copy="Send upcoming and overdue payment reminders." checked={automation.paymentWorkflow} onChange={(paymentWorkflow) => setAutomation({ ...automation, paymentWorkflow })} />
          </div>
          <div className="max-w-xl"><TextField label="Webhook base URL" type="url" value={automation.webhookUrl} onChange={(webhookUrl) => setAutomation({ ...automation, webhookUrl })} /></div>
          {saveButton('n8n', { ...automation })}
        </SettingsCard>}

        {active === 'access' && <SettingsCard icon={ShieldCheck} title="Users & access" copy="Manage client accounts and review how roles divide workspace responsibilities.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to="/users" className="surface-interactive p-5"><Users className="h-5 w-5 text-brand-light" /><p className="mt-4 font-semibold">Client accounts</p><p className="mt-2 text-sm leading-6 text-content-secondary">Create portal access for customers and review active client users.</p><span className="mt-4 block text-xs font-semibold text-brand-light">Manage accounts →</span></Link>
            <Link to="/team-access" className="surface-interactive p-5"><Link2 className="h-5 w-5 text-brand-light" /><p className="mt-4 font-semibold">Admin & team accounts</p><p className="mt-2 text-sm leading-6 text-content-secondary">Create authorized administrators and staff with role-specific access.</p><span className="mt-4 block text-xs font-semibold text-brand-light">Manage team access →</span></Link>
          </div>
        </SettingsCard>}
      </div>
    </div>
  </>
}

function SettingsCard({ icon: Icon, title, copy, children }: { icon: typeof SettingsIcon; title: string; copy: string; children: ReactNode }) {
  return <Card className="overflow-hidden"><div className="flex items-start gap-4 border-b border-line p-5 sm:p-6"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand/20 bg-brand/10"><Icon className="h-5 w-5 text-brand-light" /></span><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-content-secondary">{copy}</p></div></div><div className="space-y-6 p-5 sm:p-6">{children}</div></Card>
}

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label><span className="label">{label}</span><input className="input" min={type === 'number' ? 0 : undefined} type={type} autoCapitalize={type === 'email' ? 'none' : undefined} value={value} onChange={(event) => onChange(type === 'email' ? normalizeEmailCase(event.target.value) : event.target.value)} /></label>
}

function Toggle({ label, copy, checked, onChange }: { label: string; copy: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-start justify-between gap-5 p-4 sm:p-5"><span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-content-secondary">{copy}</span></span><span className="relative mt-0.5 shrink-0"><input className="peer sr-only" type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="block h-6 w-11 rounded-full bg-white/10 transition peer-checked:bg-brand peer-focus-visible:ring-4 peer-focus-visible:ring-brand/20" /><span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5" /></span></label>
}
