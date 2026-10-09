"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { api, Client, Mood, Journal, Quiz, Note, Assignment, Resource } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, DataList, Empty, Failure, Loading, useData, date } from "./data-list"
import { DownloadButton } from "./portal-pages"

export function PatientView({ id, back }: { id: number; back: () => void }) {
  const { data: client, error, loading, reload, revalidate } = useData<Client>(`clients/${id}`)
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") revalidate() }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh) }
  }, [revalidate])
  return <div className="space-y-6"><div className="flex gap-3"><Button variant="outline" onClick={back}>Back to patients</Button><Button variant="outline" onClick={reload}>Refresh sharing</Button></div>
    {loading ? <Loading /> : error ? <Failure error={error} retry={reload} /> : client && <>
      <Card><h2 className="text-2xl font-semibold">{client.name} <span className="text-sm font-normal text-muted-foreground">Patient #{id}</span></h2><p className="text-sm text-muted-foreground mt-2">Linked {date(client.linked_at)}</p><div className="flex gap-2 flex-wrap mt-4">{Object.entries(client.consent_flags).map(([type, shared]) => <Badge key={type} variant={shared ? "secondary" : "outline"}>{type}: {shared ? "Shared" : "Not shared"}</Badge>)}</div><p className="text-xs text-muted-foreground mt-3">Sharing is checked every 30 seconds and when you return to this window. Every request enforces current access.</p></Card>
      <PatientSections key={JSON.stringify(client.consent_flags)} client={client} />
    </>}
  </div>
}

function PatientSections({ client }: { client: Client }) {
  const base = `clients/${client.user_id}`
  const shared = client.consent_flags
  const [reportId, setReportId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  async function report() {
    setBusy(true)
    try { const result = await api<{ report: { id: number } }>("reports", { method: "POST", body: JSON.stringify({ user_id: client.user_id }) }); setReportId(result.report.id); toast.success("Report generated.") }
    catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  return <div className="space-y-6">
    <div className="flex gap-3 flex-wrap"><Button onClick={report} disabled={busy}>{busy ? "Generating PDF…" : "Generate monthly report"}</Button>{reportId && <DownloadButton id={reportId} />}</div>
    <Tabs defaultValue="overview"><TabsList className="max-w-full overflow-x-auto"><TabsTrigger value="overview">Shared data</TabsTrigger><TabsTrigger value="resources">Resources</TabsTrigger>{shared.notes && <TabsTrigger value="notes">Provider notes</TabsTrigger>}</TabsList>
      <TabsContent value="overview" className="space-y-6 mt-5">
        {!Object.values(shared).some(Boolean) && <Empty>This patient has not shared any data types. Resource assignments remain available.</Empty>}
        {shared.moods && <section><h3 className="text-lg font-semibold mb-4">Mood check-ins, triggers and coping</h3><MoodHistory path={`${base}/moods`} /></section>}
        {shared.journals && <section><h3 className="text-lg font-semibold mb-4">Journal summaries</h3><DataList<Journal> path={`${base}/journals`} empty="No shared journal entries yet." render={entry => <Card><h4 className="font-medium">{entry.title || "Journal entry"}</h4><p className="text-sm text-muted-foreground">{entry.type} · {entry.word_count ?? 0} words{entry.has_voice ? " · Voice entry" : ""} · {date(entry.created_at)}</p></Card>} /></section>}
        {shared.quizzes && <section><h3 className="text-lg font-semibold mb-4">Quiz results</h3><DataList<Quiz> path={`${base}/quizzes`} empty="No shared quiz results yet." render={entry => <Card><h4 className="font-medium">{entry.quiz_slug}</h4><p className="text-sm">Score: {entry.score} · {entry.interpretation}</p><p className="text-xs text-muted-foreground mt-2">{date(entry.completed_at)}</p></Card>} /></section>}
      </TabsContent>
      {shared.notes && <TabsContent value="notes" className="mt-5"><Notes path={`${base}/notes`} /></TabsContent>}
      <TabsContent value="resources" className="mt-5"><Assignments path={`${base}/resources`} /></TabsContent>
    </Tabs>
  </div>
}

function frequencies(entries: Mood[], field: "triggers" | "coping_strategies") {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const values = Array.isArray(entry[field]) ? [...entry[field]!] : []
    if (field === "triggers" && entry.custom_trigger) values.push(entry.custom_trigger)
    for (const name of new Set(values)) counts.set(name, (counts.get(name) || 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)
}
function MoodHistory({ path }: { path: string }) {
  return <DataList<Mood> path={path} header={entries => <MoodCharts entries={entries} />} empty="No shared mood check-ins yet." render={entry => <Card><div className="flex flex-wrap justify-between gap-2"><h4 className="font-medium">{entry.mood} · Intensity {entry.intensity}/10</h4><span className="text-xs text-muted-foreground">{date(entry.client_created_at || entry.created_at)}</span></div><p className="text-sm mt-2">Triggers: {[...(entry.triggers || []), ...(entry.custom_trigger ? [entry.custom_trigger] : [])].join(", ") || "None recorded"}</p><p className="text-sm mt-1">Coping: {entry.coping_strategies?.join(", ") || "None recorded"}{entry.coping_helped && <span> · Feedback: {entry.coping_helped}</span>}</p></Card>} />
}

// Charts and rows use the same authorized page, avoiding an unaudited summary request.
export function MoodCharts({ entries }: { entries: Mood[] }) {
  if (!entries.length) return null
  const chart = [...entries].reverse().map(entry => ({ date: entry.client_created_at || entry.created_at, intensity: entry.intensity }))
  return <div className="space-y-5"><Card><h4 className="font-medium mb-3">Mood intensity · current page</h4><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)" }} tickFormatter={value => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })} minTickGap={30} /><YAxis domain={[0, 10]} tick={{ fill: "var(--muted-foreground)" }} /><Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} /><Line isAnimationActive={false} dataKey="intensity" name="Intensity (0–10)" stroke="var(--chart-1)" connectNulls={false} /></LineChart></ResponsiveContainer></div></Card><div className="grid gap-4 lg:grid-cols-2">{(["triggers", "coping_strategies"] as const).map(field => { const data = frequencies(entries, field); return <Card key={field}><h4 className="font-medium mb-3">{field === "triggers" ? "Top triggers" : "Coping usage"} · current page</h4>{!data.length ? <Empty>No {field === "triggers" ? "triggers" : "coping strategies"} recorded on this page.</Empty> : <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical"><XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted-foreground)" }} /><YAxis type="category" dataKey="name" width={110} tick={{ fill: "var(--muted-foreground)" }} /><Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} /><Bar isAnimationActive={false} dataKey="count" name="Check-ins" fill="var(--chart-2)" /></BarChart></ResponsiveContainer></div>}</Card> })}</div></div>
}

function Notes({ path }: { path: string }) {
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    try { await api(path, { method: "POST", body: JSON.stringify({ body }) }); setBody(""); setRevision(n => n + 1); toast.success("Note saved.") }
    catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  async function remove(id: number) {
    if (!window.confirm("Delete this provider note?")) return
    setBusy(true)
    try { await api(`${path}/${id}`, { method: "DELETE" }); setRevision(n => n + 1); toast.success("Note deleted.") }
    catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  return <div className="space-y-5"><form onSubmit={save} className="space-y-3"><label htmlFor="provider-note" className="font-medium">New provider note</label><Textarea id="provider-note" value={body} onChange={event => setBody(event.target.value)} required maxLength={5000} /><Button disabled={busy || !body.trim()}>Save note</Button></form><DataList<Note> path={path} revision={revision} empty="No provider notes yet." render={note => <Card><p className="whitespace-pre-wrap break-words">{note.body}</p><div className="flex items-center justify-between mt-3"><span className="text-xs text-muted-foreground">{date(note.created_at)}</span><Button variant="outline" disabled={busy} onClick={() => remove(note.id)}>Delete</Button></div></Card>} /></div>
}

function Assignments({ path }: { path: string }) {
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [notes, setNotes] = useState("")
  async function assign(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    try { await api(path, { method: "POST", body: JSON.stringify({ resource_id: selected, notes }) }); setRevision(n => n + 1); setSelected(null); setNotes(""); toast.success("Resource assigned.") }
    catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  async function remove(id: number) {
    if (!window.confirm("Remove this resource assignment?")) return
    setBusy(true)
    try { await api(`${path}/${id}`, { method: "DELETE" }); setRevision(n => n + 1) }
    catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  return <div className="space-y-6"><section><h3 className="text-lg font-semibold mb-3">Assigned resources</h3><DataList<Assignment> path={path} revision={revision} empty="No resources assigned to this patient yet." render={assignment => <Card><h4 className="font-semibold">{assignment.resource.title}</h4><Badge className="my-2" variant="secondary">{assignment.status}</Badge><p className="text-sm whitespace-pre-wrap">{assignment.notes}</p><p className="text-xs text-muted-foreground mt-2">Assigned {date(assignment.assigned_at)}</p><Button className="mt-3" variant="outline" disabled={busy} onClick={() => remove(assignment.id)}>Remove assignment</Button></Card>} /></section><section><h3 className="text-lg font-semibold mb-3">Assign from your library</h3><DataList<Resource> path="resources" empty="Your library is empty. Add a resource in Resources first." render={resource => <Card><div className="flex items-center justify-between gap-3"><div><h4 className="font-medium">{resource.title}</h4><p className="text-sm text-muted-foreground">{resource.type}</p></div><Button variant={selected === resource.id ? "default" : "outline"} onClick={() => setSelected(resource.id)} disabled={busy}>Select</Button></div></Card>} />{selected && <form onSubmit={assign} className="mt-4 space-y-3"><label htmlFor="assignment-notes">Patient guidance (optional)</label><Textarea id="assignment-notes" value={notes} onChange={event => setNotes(event.target.value)} maxLength={5000} /><Button disabled={busy}>{busy ? "Assigning…" : "Assign selected resource"}</Button></form>}</section></div>
}



