"use client"

import { BookOpen } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { api, Provider, Resource, Report, AccessLog, freshNavigation } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, DataList, date } from "./data-list"

export function ProviderSettings({ provider, saved }: { provider: Provider; saved: () => void }) {
  const [busy, setBusy] = useState(false)
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true)
    try { await api("me", { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); toast.success("Settings saved."); saved() }
    catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  return <Card><form onSubmit={save} className="space-y-5 max-w-xl"><label className="block text-sm">Name<Input name="name" defaultValue={provider.name} required maxLength={120} className="mt-2" /></label><label className="block text-sm">Practice<Input name="practice" defaultValue={provider.practice || ""} maxLength={255} className="mt-2" /></label><label className="block text-sm">Timezone<Input name="timezone" defaultValue={provider.timezone || "UTC"} required placeholder="Africa/Lagos" className="mt-2" /></label><p className="text-xs text-muted-foreground">Timezone determines the default period for monthly reports. Use an IANA timezone such as Africa/Lagos or Europe/London.</p><label className="block text-sm">Registered email<Input value={provider.email} readOnly className="mt-2" /></label><p className="text-sm text-muted-foreground">License: {provider.license_number || "Not supplied"}{provider.license_state ? ` (${provider.license_state})` : ""}</p><Badge variant="secondary">{provider.is_verified ? "Verified provider" : "Verification pending"}</Badge><div><Button disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button></div></form></Card>
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
  return <div className="space-y-6"><Button onClick={() => { setEditing(null); setShowForm(true) }} disabled={busy}>Add resource</Button>
    {showForm && <Card><h2 className="font-semibold text-lg mb-4">{editing ? "Edit resource" : "New resource"}</h2><form key={editing?.id || "new"} onSubmit={save} className="space-y-4"><label className="block text-sm">Title<Input name="title" defaultValue={editing?.title} required maxLength={255} /></label><label className="block text-sm">Type<select name="type" defaultValue={editing?.type || "article"} className="block w-full border rounded-md bg-background p-2 mt-1">{[...new Set(["article", "video", "meditation", "exercise", ...(editing ? [editing.type] : [])])].map(type => <option key={type}>{type}</option>)}</select></label><label className="block text-sm">Duration in minutes (optional)<Input name="duration_minutes" type="number" min={1} max={10080} defaultValue={editing?.duration_minutes || ""} /></label><label className="block text-sm">Description<Textarea name="description" maxLength={10000} defaultValue={editing?.description || ""} /></label><label className="block text-sm">Resource URL (optional)<Input name="url" type="url" pattern="https?://.*" maxLength={255} defaultValue={editing?.url || ""} /></label><div className="flex flex-wrap gap-3"><Button disabled={busy}>{busy ? "Saving…" : "Save resource"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setShowForm(false)}>Cancel</Button></div></form></Card>}
    <DataList<Resource> path="resources" revision={revision} empty={<><BookOpen aria-hidden="true" className="mx-auto mb-3 size-8 text-primary" /><span className="block text-base font-semibold text-foreground">Build your resource library</span><span className="mt-2 block">Add your first article, video, meditation or exercise using Add resource above.</span></>} render={resource => <Card><div className="flex flex-wrap justify-between gap-4"><div className="min-w-0"><h2 className="break-words font-semibold">{resource.title}</h2><p className="text-sm text-muted-foreground mt-1">{resource.type}{resource.duration_minutes ? ` · ${resource.duration_minutes} min` : ""}</p><p className="text-sm mt-3 whitespace-pre-wrap break-words">{resource.description}</p>{resource.url && /^https?:\/\//i.test(resource.url) && <a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-block text-primary underline mt-3">Open resource</a>}</div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => { setEditing(resource); setShowForm(true) }}>Edit</Button><Button variant="outline" disabled={busy} onClick={() => remove(resource)}>Delete</Button></div></div></Card>} />
  </div>
}

export function DownloadButton({ id }: { id: number }) {
  const [busy, setBusy] = useState(false)
  async function download() {
    setBusy(true)
    try {
      const response = await fetch(`/api/provider/reports/${id}/pdf`, { cache: "no-store", credentials: "same-origin" })
      if (!response.ok) { if (response.status === 401) freshNavigation("/login?expired=1"); const data = await response.json(); throw new Error(data.message || "Download failed.") }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement("a"); link.href = url; link.download = `provider-report-${id}.pdf`; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  return <Button variant="outline" onClick={download} disabled={busy}>{busy ? "Downloading…" : "Download PDF"}</Button>
}
export function Reports() {
  return <div className="space-y-5"><p className="text-sm text-muted-foreground">Generate a monthly report from a patient view. Downloads check current sharing permissions; generate a fresh report if consent has changed.</p><DataList<Report> path="reports" empty="No reports generated yet. Open a patient to generate a monthly PDF." render={report => <Card><div className="flex items-center flex-wrap justify-between gap-3"><div><h2 className="font-semibold">Patient #{report.user_id} · Monthly report</h2><p className="text-sm text-muted-foreground">{report.period_start.slice(0, 10)} – {report.period_end.slice(0, 10)}</p><p className="text-xs text-muted-foreground mt-2">Generated {date(report.generated_at)}</p></div><DownloadButton id={report.id} /></div></Card>} /></div>
}

export function AuditLog() {
  const [filter, setFilter] = useState("")
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    for (const [key, value] of new FormData(event.currentTarget)) if (value) params.set(key, String(value))
    setFilter(params.toString())
  }
  return <div className="space-y-5"><form onSubmit={apply} className="flex flex-wrap gap-3 items-end"><label className="w-full min-w-0 text-sm sm:w-auto">From<Input name="from" type="date" /></label><label className="w-full min-w-0 text-sm sm:w-auto">To<Input name="to" type="date" /></label><label className="w-full min-w-0 text-sm sm:w-auto">Action<Input name="action" placeholder="e.g. view" maxLength={100} /></label><label className="w-full min-w-0 text-sm sm:w-auto">Resource type<Input name="resource_type" placeholder="e.g. mood" maxLength={100} /></label><Button>Apply filters</Button><Button type="reset" variant="outline" onClick={() => setFilter("")}>Clear</Button></form><p className="text-sm text-muted-foreground">Your access history includes patient IDs, actions, resource IDs and timestamps. Older entries remain visible after a patient revokes access.</p><DataList<AccessLog> key={filter} path={`access-log${filter ? `?${filter}` : ""}`} empty="No audit entries match this view." render={entry => <Card><div className="flex justify-between flex-wrap gap-2"><h2 className="font-medium">{entry.action} · {entry.resource_type}</h2><span className="text-xs text-muted-foreground">{date(entry.created_at)}</span></div><p className="text-sm text-muted-foreground mt-2">{entry.user_id ? `Patient #${entry.user_id}` : "Account activity"}{entry.resource_id ? ` · Resource #${entry.resource_id}` : ""}</p></Card>} /></div>
}
