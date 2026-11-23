"use client"
import { AppearanceSettings } from "@/components/workspace/preferences"
import { providerFetch, assertProviderResponse } from "@/lib/provider-api"


import { BookOpen, Plus, ArrowUpRight, FileText, Clock, ShieldCheck, Pencil, Trash2, UserRound, Paintbrush } from "lucide-react"
import { useState } from "react"
import { WorkspaceSection, WorkspaceNote } from "@/components/workspace/workspace-section"
import { toast } from "sonner"
import { api, Provider, Resource, Report, AccessLog, freshNavigation } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, DataList, date } from "./data-list"

export function ProviderSettings({ provider, saved }: { provider: Provider; saved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [settingsSection, setSettingsSection] = useState("profile")
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true)
    try { await api("me", { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); toast.success("Settings saved."); saved() }
    catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  return <div className="settings-workspace"><nav aria-label="Settings sections" className="settings-section-navigation"><p>Personal settings</p>{([{ key:'profile', label:'Profile & account', icon:UserRound },{ key:'appearance', label:'Appearance & layout', icon:Paintbrush },{ key:'security', label:'Sign-in & security', icon:ShieldCheck }] as const).map(({key,label,icon:Icon}) => <button type="button" aria-pressed={settingsSection===key} key={key} onClick={() => setSettingsSection(key)}><Icon size={17} />{label}</button>)}</nav><div className="min-w-0"><div hidden={settingsSection !== 'appearance'}><section className="workspace-panel workspace-section-body"><AppearanceSettings /></section></div><div hidden={settingsSection !== 'security'}><WorkspaceSection title="Sign-in & security" description="Manage the protection on your provider account."><div className="settings-security-note"><ShieldCheck size={28} /><div><h3>Keep your workspace protected</h3><p>Review your sign-in controls and trusted devices in your existing security settings.</p></div></div><a href="/provider/security" className="workspace-text-link mt-5">Manage sign-in protection →</a></WorkspaceSection></div><div hidden={settingsSection !== 'profile'}><div className="workspace-settings-grid">
    <WorkspaceSection title="Professional profile" description="Keep your name, practice and report timezone up to date.">
      <form onSubmit={save} className="space-y-6">
        <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
          <label className="workspace-field">Name<Input name="name" defaultValue={provider.name} required maxLength={120} autoComplete="name" /></label>
          <label className="workspace-field">Practice<Input name="practice" defaultValue={provider.practice || ""} maxLength={255} autoComplete="organization" /></label>
          <label className="workspace-field">Timezone<Input name="timezone" aria-label="Timezone" aria-describedby="provider-timezone-hint" defaultValue={provider.timezone || "UTC"} required placeholder="Africa/Lagos" /><span id="provider-timezone-hint" className="workspace-field-hint">Used for monthly reports. Enter an IANA timezone, such as Africa/Lagos.</span></label>
          <label className="workspace-field">Registered email<Input aria-label="Registered email" aria-describedby="provider-email-hint" value={provider.email} readOnly autoComplete="email" /><span id="provider-email-hint" className="workspace-field-hint">Your registered sign-in address is read-only.</span></label>
        </fieldset>
        <div className="workspace-form-actions"><p className="text-xs text-muted-foreground">Changes apply to your provider profile.</p><Button disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button></div>
      </form>
    </WorkspaceSection>
    <aside className="space-y-5">
      <WorkspaceSection title="Email verification" description="Email ownership is the verification required for your provider account."><dl className="workspace-details"><div><dt>Registered email</dt><dd>{provider.email}</dd></div><div><dt>Email status</dt><dd><Badge variant="secondary">{provider.is_verified ? "Email verified" : "Email verification required"}</Badge></dd></div></dl></WorkspaceSection>
      <WorkspaceSection title="Sign-in protection" description="Review your account’s existing security controls."><a href="/provider/security" className="workspace-text-link">Manage sign-in protection →</a></WorkspaceSection>
    </aside>
  </div></div></div></div>
}

export function ResourceLibrary() {
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Resource | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true)
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    const payload = { ...fields, duration_minutes: fields.duration_minutes ? Number(fields.duration_minutes) : null, url: fields.url || null, description: fields.description || null }
    try { await api(editing ? `resources/${editing.id}` : "resources", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) }); setRevision(n => n + 1); setShowForm(false); setEditing(null); toast.success("Resource saved.") }
    catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  async function remove(resource: Resource) {
    if (!window.confirm(`Delete “${resource.title}” and its patient assignments?`)) return
    setBusy(true)
    try { await api(`resources/${resource.id}`, { method: "DELETE" }); setRevision(n => n + 1); toast.success("Resource deleted.") }
    catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  return <div className="space-y-6">
    <section className="workspace-hero"><div><p className="!mt-0 text-[10px] uppercase tracking-[.15em]">A library for your practice</p><h2 className="mt-3">Useful resources. Ready to share.</h2><p>Keep articles, videos, meditations and exercises together, then assign a resource from a connected patient’s workspace.</p></div><Button onClick={() => { setEditing(null); setShowForm(true) }} disabled={busy}><Plus size={16} aria-hidden="true" />Add resource</Button></section>
    <div className="workspace-editor-grid"><div className="min-w-0 space-y-6">
      {showForm && <Card><div className="mb-6 flex items-center gap-3 border-b pb-5"><span className="workspace-stat-icon"><Pencil size={18} aria-hidden="true" /></span><div><h2 className="text-lg font-semibold">{editing ? "Edit resource" : "New resource"}</h2><p className="mt-1 text-xs text-muted-foreground">Add the details patients need to use this resource.</p></div></div>
        <form key={editing?.id || "new"} onSubmit={save} className="space-y-5"><fieldset disabled={busy} className="space-y-5">
          <label className="block text-sm font-medium">Title<Input className="mt-2" name="title" defaultValue={editing?.title} required maxLength={255} /></label>
          <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium">Type<select name="type" defaultValue={editing?.type || "article"} className="mt-2 block w-full rounded-lg border bg-background px-3">{[...new Set(["article", "video", "meditation", "exercise", ...(editing ? [editing.type] : [])])].map(type => <option key={type}>{type}</option>)}</select></label><label className="block text-sm font-medium">Duration in minutes (optional)<Input className="mt-2" name="duration_minutes" type="number" min={1} max={10080} defaultValue={editing?.duration_minutes || ""} /></label></div>
          <label className="block text-sm font-medium">Description<Textarea className="mt-2" name="description" maxLength={10000} defaultValue={editing?.description || ""} /></label>
          <label className="block text-sm font-medium">Resource URL (optional)<Input className="mt-2" name="url" type="url" pattern="https?://.*" maxLength={255} defaultValue={editing?.url || ""} /></label>
        </fieldset><div className="flex flex-wrap justify-end gap-3 border-t pt-5"><Button type="button" variant="outline" disabled={busy} onClick={() => setShowForm(false)}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : "Save resource"}</Button></div></form>
      </Card>}
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Resource library</h2><span className="text-xs text-muted-foreground">Your practice’s collection</span></div>
      <DataList<Resource> path="resources" revision={revision} layout="grid" empty={<><span className="workspace-empty-symbol mx-auto"><BookOpen size={28} aria-hidden="true" /></span><span className="block text-lg font-semibold text-foreground">Build your resource library</span><span className="mt-3 block">Add your first article, video, meditation or exercise using Add resource above.</span></>} render={resource => <Card>
        <div className="mb-5 flex items-center justify-between gap-3"><span className="workspace-stat-icon"><FileText size={20} aria-hidden="true" /></span><Badge variant="secondary">{resource.type}</Badge></div>
        <h2 className="break-words text-lg font-semibold">{resource.title}</h2>
        {resource.duration_minutes && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Clock size={13} aria-hidden="true" />{resource.duration_minutes} min</p>}
        {resource.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{resource.description}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">{resource.url && /^https?:\/\//i.test(resource.url) && <a href={resource.url} target="_blank" rel="noopener noreferrer" className="mr-auto inline-flex min-h-11 items-center gap-2 text-xs font-medium text-primary">Open resource<ArrowUpRight size={14} aria-hidden="true" /></a>}<Button variant="ghost" disabled={busy} onClick={() => { setEditing(resource); setShowForm(true) }}><Pencil size={14} aria-hidden="true" />Edit</Button><Button variant="ghost" disabled={busy} onClick={() => remove(resource)}><Trash2 size={14} aria-hidden="true" />Delete</Button></div>
      </Card>} />
    </div><aside className="workspace-panel workspace-context-card"><ShieldCheck className="mb-4 text-primary" size={24} aria-hidden="true" /><h2>Make each resource useful</h2><p>Use a clear title, explain what the resource contains and include its duration when relevant.</p><div className="mt-5 border-t pt-4"><h2>Share with intention</h2><p>Adding a resource keeps it in your library. Assign it from a patient’s workspace when it is appropriate for their care.</p></div></aside></div>
  </div>
}

export function DownloadButton({ id }: { id: number }) {
  const [busy, setBusy] = useState(false)
  async function download() {
    setBusy(true)
    try {
      const response = await providerFetch(`reports/${id}/pdf`)
      if (!response.ok) { if (response.status === 401) freshNavigation("/login?expired=1"); const data = await response.json(); throw new Error(data.message || "Download failed.") }
      const blob = await response.blob()
      assertProviderResponse(response)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a"); link.href = url; link.download = `provider-report-${id}.pdf`; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  return <Button variant="outline" onClick={download} disabled={busy}>{busy ? "Downloading…" : "Download PDF"}</Button>
}
export function Reports() {
  return <div className="space-y-6"><WorkspaceNote title="Reports follow current sharing choices">Generate a monthly report from a patient view. Downloads check current sharing permissions; generate a fresh report if consent has changed.</WorkspaceNote><DataList<Report> path="reports" empty="No reports generated yet. Open a patient to generate a monthly PDF." render={report => <Card><div className="flex items-center flex-wrap justify-between gap-3"><div><h2 className="font-semibold">Patient #{report.user_id} · Monthly report</h2><p className="text-sm text-muted-foreground">{report.period_start.slice(0, 10)} – {report.period_end.slice(0, 10)}</p><p className="text-xs text-muted-foreground mt-2">Generated {date(report.generated_at)}</p></div><DownloadButton id={report.id} /></div></Card>} /></div>
}

export function AuditLog() {
  const [filter, setFilter] = useState("")
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    for (const [key, value] of new FormData(event.currentTarget)) if (value) params.set(key, String(value))
    setFilter(params.toString())
  }
  return <div className="space-y-6">
    <WorkspaceSection title="Filter access history" description="Narrow the history by date, action or record type.">
      <form onSubmit={apply} className="workspace-filter-grid">
        <label className="workspace-field">From<Input name="from" type="date" /></label><label className="workspace-field">To<Input name="to" type="date" /></label>
        <label className="workspace-field">Action<Input name="action" placeholder="e.g. view" maxLength={100} /></label><label className="workspace-field">Resource type<Input name="resource_type" placeholder="e.g. mood" maxLength={100} /></label>
        <div className="workspace-filter-actions"><Button>Apply filters</Button><Button type="reset" variant="outline" onClick={() => setFilter("")}>Clear</Button></div>
      </form>
    </WorkspaceSection>
    <WorkspaceNote title="An accountable record of access">This history records patient IDs, actions, resource IDs and timestamps. Older entries remain visible after a patient revokes access.</WorkspaceNote>
    <DataList<AccessLog> key={filter} path={`access-log${filter ? `?${filter}` : ""}`} empty="No audit entries match this view." render={entry => <article className="workspace-panel workspace-audit-row">
      <span className="workspace-stat-icon"><ShieldCheck size={18} aria-hidden="true" /></span><div className="min-w-0"><h2 className="text-sm font-semibold capitalize">{entry.action.replaceAll("_", " ")} <span className="font-normal text-muted-foreground">· {entry.resource_type}</span></h2><p className="mt-2 text-xs text-muted-foreground">{entry.user_id ? `Patient #${entry.user_id}` : "Account activity"}{entry.resource_id ? ` · Resource #${entry.resource_id}` : ""}</p></div><time className="text-xs text-muted-foreground">{date(entry.created_at)}</time>
    </article>} />
  </div>
}
