"use client"

import { Button } from "@/components/ui/button"
import { ArrowUpRight, HeartHandshake, MessageCircle, Users, ClipboardList, ShieldCheck } from "lucide-react"
import { Card, Failure, Loading, date, useData } from "./data-list"
import { PatientRoster } from "./patient-roster"

type Overview = { data: { checked_at: string; totals: { connected_patients: number; unread_messages: number; shared_assessments: number } } }
type Destination = "Patients" | "Messages" | "Shared assessment results"

export function ProviderOverview({ navigate, openPatient }: { navigate: (destination: Destination) => void; openPatient: (id: number) => void }) {
  const { data, error, loading, refreshing, reload } = useData<Overview>("overview", { retainOnReload: true })
  if (loading) return <Loading />
  if (error) return <Failure error={error} retry={reload} />
  if (!data) return <Failure error="Overview is unavailable." retry={reload} />
  const metrics = [
    { label: "Connected patients", value: data.data.totals.connected_patients, destination: "Patients" as Destination, icon: Users },
    { label: "Unread patient messages", value: data.data.totals.unread_messages, destination: "Messages" as Destination, icon: MessageCircle },
    { label: "Shared assessment results", value: data.data.totals.shared_assessments, destination: "Shared assessment results" as Destination, icon: ClipboardList },
  ]
  return <div className="space-y-6" aria-busy={refreshing}>

    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Current totals · Checked {date(data.data.checked_at)}</p><Button variant="ghost" disabled={refreshing} onClick={reload}>{refreshing ? "Refreshing overview…" : "Refresh overview"}</Button></div>
    <div className="workspace-stats">{metrics.map(metric => <section className="workspace-panel workspace-stat" key={metric.label}>
      <div className="workspace-stat-top"><h2 className="workspace-stat-label">{metric.label}</h2><span className="workspace-stat-icon"><metric.icon size={19} aria-hidden="true" /></span></div><p className="workspace-stat-value">{metric.value}</p>
      <button className="workspace-stat-link" onClick={() => navigate(metric.destination)}>View {metric.destination.toLowerCase()}<ArrowUpRight size={14} aria-hidden="true" /></button>
    </section>)}</div>
    <PatientRoster showSummary select={openPatient} />
    <div className="overview-quick-actions"><span><ShieldCheck size={15} />Patient-controlled sharing</span><div><Button variant="outline" onClick={() => navigate("Patients")}>Open patient directory<ArrowUpRight size={15} /></Button><Button onClick={() => navigate("Messages")}>Open messages<MessageCircle size={15} /></Button></div></div>
  </div>
}
