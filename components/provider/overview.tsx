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
    <section className="workspace-hero"><div><HeartHandshake className="mb-4" size={30} aria-hidden="true" /><h2>A clearer view of your patients</h2><p>{metrics.every(metric => metric.value === 0) ? "Your workspace is ready. Accept a patient invitation to start reviewing the information they choose to share." : "See what needs your attention, continue conversations and review shared information from one workspace."}</p></div><Button onClick={() => navigate("Patients")}>Open patient directory<ArrowUpRight size={16} aria-hidden="true" /></Button></section>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Current totals · Checked {date(data.data.checked_at)}</p><Button variant="ghost" disabled={refreshing} onClick={reload}>{refreshing ? "Refreshing overview…" : "Refresh overview"}</Button></div>
    <div className="workspace-stats">{metrics.map(metric => <section className="workspace-panel workspace-stat" key={metric.label}>
      <div className="workspace-stat-top"><h2 className="workspace-stat-label">{metric.label}</h2><span className="workspace-stat-icon"><metric.icon size={19} aria-hidden="true" /></span></div><p className="workspace-stat-value">{metric.value}</p>
      <button className="workspace-stat-link" onClick={() => navigate(metric.destination)}>View {metric.destination.toLowerCase()}<ArrowUpRight size={14} aria-hidden="true" /></button>
    </section>)}</div>
    <div className="workspace-editor-grid"><section className="workspace-panel p-5 sm:p-6"><PatientRoster select={openPatient} /></section><aside className="workspace-panel workspace-context-card"><ShieldCheck className="mb-4 text-primary" size={24} aria-hidden="true" /><h2>Sharing stays with the patient</h2><p>Patients decide which records to share. Their choices can change at any time, and every request checks current access.</p><div className="mt-5 border-t pt-4"><p className="!mt-0">A follow-up priority is a conversation aid. It is not a diagnosis or a clinical assessment.</p></div></aside></div>
  </div>
}
