"use client"

import { useEffect, useMemo, useState } from "react"
import { UserRoundPlus } from "lucide-react"
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

export function PatientRoster({ select, email, allowConnection = false, title = "Follow-up priority" }: { select: (id: number) => void; email?: string; allowConnection?: boolean; title?: string }) {
  const { data, error, loading, reload } = useData<Client[]>("clients")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [adding, setAdding] = useState(false)
  useEffect(() => { const refresh = () => reload(); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh) }, [reload])
  const sorted = useMemo(() => [...(data || [])].sort((a, b) => order[patientState(a)] - order[patientState(b)] || a.name.localeCompare(b.name) || a.user_id - b.user_id), [data])
  const filtered = sorted.filter(client => (filter === "all" || patientState(client) === filter) && (client.name.toLowerCase().includes(search.toLowerCase()) || String(client.user_id).includes(search)))
  const counts = useMemo(() => sorted.reduce<Record<string, number>>((result, client) => { const key = patientState(client); result[key] = (result[key] || 0) + 1; return result }, {}), [sorted])
  if (loading) return <Loading />
  if (error) return <Failure error={error} retry={reload} />
  return <section className="space-y-5" aria-labelledby="priority-roster-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="priority-roster-title" className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">Priority reflects negative mood days in the latest seven days. It is a follow-up aid, not a diagnosis.</p></div>{allowConnection && email && <Button onClick={() => setAdding(true)}><UserRoundPlus aria-hidden="true" className="size-4" />Accept patient invitation</Button>}</div>
    {adding && email && <PatientConnection email={email} close={() => setAdding(false)} connected={() => { toast.success("Patient connected."); reload() }} />}
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><Input aria-label="Search patients" placeholder="Search by first name or patient ID" value={search} onChange={event => setSearch(event.target.value)} /><select aria-label="Filter priority" value={filter} onChange={event => setFilter(event.target.value as Filter)} className="min-h-10 rounded-md border bg-background px-3"><option value="all">All priorities ({sorted.length})</option>{(Object.keys(labels) as PatientState[]).map(value => <option key={value} value={value}>{labels[value]} ({counts[value] || 0})</option>)}</select><Button variant="outline" onClick={reload}>Refresh</Button></div>
    {!data?.length ? <Empty>No linked patients yet. Patients appear after you accept their invitation.</Empty> : !filtered.length ? <Empty>No patients match the current search and filter.</Empty> : <div className="space-y-3">{filtered.map(client => {
      const current = patientState(client), summary = client.mood_summary
      return <Card key={client.user_id}><div className="flex flex-wrap items-center justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-lg font-semibold">{client.name} <span className="text-sm font-normal text-muted-foreground">· Patient #{client.user_id}</span></h3><Badge variant={priorityVariant(current)}>{labels[current]}</Badge></div><p className="mt-2 text-sm">{summary?.priority.explanation || "Mood-derived information is private."}</p><p className="mt-1 text-xs text-muted-foreground">{summary ? `${summary.coverage.recorded_days} of 7 days logged · ${summary.coverage.check_ins} check-ins · Latest ${date(summary.latest_check_in)}` : `Linked ${date(client.linked_at)}`}</p></div><Button onClick={() => select(client.user_id)}>Open insights</Button></div></Card>
    })}</div>}
  </section>
}
