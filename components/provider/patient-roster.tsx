"use client"

import { useEffect, useMemo, useState } from "react"
import { UserRoundPlus, ArrowUpRight, ShieldCheck, Activity, Users } from "lucide-react"
import { toast } from "sonner"
import { type Client } from "@/lib/provider-api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, Empty, Failure, Loading, date, useData } from "./data-list"
import { PatientConnection } from "./patient-connection"

type Filter = "all" | "high" | "moderate" | "low" | "no_negative" | "no_checkins" | "sharing_off"
type PatientState = Exclude<Filter, "all">
const order: Record<Filter, number> = { all: -1, high: 0, moderate: 1, low: 2, no_negative: 3, no_checkins: 4, sharing_off: 5 }
const labels: Record<PatientState, string> = { high: "High", moderate: "Moderate", low: "Low", no_negative: "No negative days", no_checkins: "No check-ins", sharing_off: "Mood sharing off" }

function patientState(client: Client): PatientState {
  if (!client.consent_flags.moods || !client.mood_summary) return "sharing_off"
  return client.mood_summary.priority.status
}

function priorityVariant(value: PatientState): "default" | "secondary" | "outline" | "destructive" {
  if (value === "high") return "destructive"
  if (value === "moderate") return "default"
  return value === "low" ? "secondary" : "outline"
}

export function PatientRoster({ select, email, allowConnection = false, title = "Follow-up priority", showSummary = false }: { showSummary?: boolean; select: (id: number) => void; email?: string; allowConnection?: boolean; title?: string }) {
  const { data, error, loading, refreshing, reload } = useData<Client[]>("clients", { retainOnReload: true })
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [adding, setAdding] = useState(false)
  useEffect(() => { const refresh = () => reload(); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh) }, [reload])
  const sorted = useMemo(() => [...(data || [])].sort((a, b) => order[patientState(a)] - order[patientState(b)] || a.name.localeCompare(b.name) || a.user_id - b.user_id), [data])
  const filtered = sorted.filter(client => (filter === "all" || patientState(client) === filter) && (client.name.toLowerCase().includes(search.toLowerCase()) || String(client.user_id).includes(search)))
  const counts = useMemo(() => sorted.reduce<Record<string, number>>((result, client) => { const key = patientState(client); result[key] = (result[key] || 0) + 1; return result }, {}), [sorted])
  if (loading) return <Loading />
  if (error) return <Failure error={error} retry={reload} />
  return <section className="space-y-5" aria-labelledby="priority-roster-title" aria-busy={refreshing}>
    {showSummary && sorted.length > 0 && <div className="provider-overview-widgets">
      <section className="workspace-panel sharing-widget"><div className="widget-heading"><div><span className="widget-symbol"><ShieldCheck size={17} /></span><h2>Sharing overview</h2></div><span className="workspace-widget-caption">Current connections</span></div><div className="sharing-widget-body"><div className="sharing-donut" role="img" aria-label={`${sorted.filter(c => c.consent_flags.moods).length} of ${sorted.length} connected patients share moods`} style={{ background: `conic-gradient(var(--workspace-accent) ${sorted.filter(c => c.consent_flags.moods).length / sorted.length * 100}%,var(--workspace-soft) 0)` }}><div><strong>{sorted.length}</strong><span>Connected</span></div></div><dl className="sharing-legend"><div><dt><i />Mood sharing on</dt><dd>{sorted.filter(c => c.consent_flags.moods).length}</dd></div><div><dt><i className="is-muted" />Mood sharing off</dt><dd>{sorted.filter(c => !c.consent_flags.moods).length}</dd></div></dl></div><p className="widget-footnote">Patients control which records are available to you.</p></section>
      <section className="workspace-panel priority-widget"><div className="widget-heading"><div><span className="widget-symbol"><Activity size={17} /></span><h2>Follow-up distribution</h2></div><span className="workspace-widget-caption">Latest 7 days</span></div><div className="priority-bars">{(['high','moderate','low','no_negative','no_checkins'] as const).map(key => <div className="priority-bar-row" key={key}><span>{labels[key]}</span><div><i data-priority={key} style={{ width: `${(counts[key] || 0) / sorted.length * 100}%` }} /></div><strong>{counts[key] || 0}</strong></div>)}</div><p className="widget-footnote">A follow-up aid based on shared check-ins; not a diagnosis.</p></section>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="priority-roster-title" className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">Priority reflects negative mood days in the latest seven days. It is a follow-up aid, not a diagnosis.</p></div>{allowConnection && email && <Button onClick={() => setAdding(true)}><UserRoundPlus aria-hidden="true" className="size-4" />Accept patient invitation</Button>}</div>
    {adding && email && <PatientConnection email={email} close={() => setAdding(false)} connected={() => { toast.success("Patient connected."); reload() }} />}

    <div className="workspace-panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><Input aria-label="Search patients" placeholder="Search by first name or patient ID" value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Filter priority" value={filter} onChange={event => setFilter(event.target.value as Filter)} className="min-h-10 rounded-md border bg-background px-3"><option value="all">All priorities ({sorted.length})</option>{(Object.keys(labels) as PatientState[]).map(value => <option key={value} value={value}>{labels[value]} ({counts[value] || 0})</option>)}</select><Button variant="outline" disabled={refreshing} onClick={reload}>{refreshing ? "Refreshing…" : "Refresh"}</Button></div>
    {!data?.length ? <Empty>No linked patients yet. Patients appear after you accept their invitation.</Empty> : !filtered.length ? <Empty>No patients match the current search and filter.</Empty> : <div className="patient-worklist"><div className="patient-worklist-heading"><span>Patient</span><span>Follow-up</span><span>Shared activity</span><span>Latest check-in</span><span className="sr-only">Open patient</span></div>{filtered.map(client => {
      const current = patientState(client), summary = client.mood_summary
      return <article className="patient-worklist-row" key={client.user_id}><div className="patient-worklist-identity"><span className="workspace-avatar" aria-hidden="true">{client.name.split(/\s+/).slice(0,2).map(n => n[0]).join('')}</span><div><h3>{client.name}</h3><span>Patient #{client.user_id}</span></div></div><div className="patient-worklist-priority"><Badge variant={priorityVariant(current)}>{labels[current]}</Badge><p>{summary?.priority.explanation || "Mood-derived information is private."}</p></div><div className="patient-worklist-coverage">{summary ? <><strong>{summary.coverage.recorded_days}<span> / 7 days</span></strong><div className="coverage-track"><i style={{ width: `${Math.min(100, summary.coverage.recorded_days / 7 * 100)}%` }} /></div><span>{summary.coverage.check_ins} check-ins</span></> : <span>Sharing off</span>}</div><time className="patient-worklist-date">{summary ? date(summary.latest_check_in) : `Linked ${date(client.linked_at)}`}</time><Button variant="outline" onClick={() => select(client.user_id)}>Open insights<ArrowUpRight size={14} /></Button></article>
    })}</div>}

  </section>
}
