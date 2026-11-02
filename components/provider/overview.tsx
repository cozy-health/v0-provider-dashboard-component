"use client"

import { Button } from "@/components/ui/button"
import { Card, Failure, Loading, date, useData } from "./data-list"

type Overview = { data: { checked_at: string; totals: { connected_patients: number; unread_messages: number; shared_assessments: number } } }
type Destination = "Patients" | "Messages" | "Shared assessment results"

export function ProviderOverview({ navigate }: { navigate: (destination: Destination) => void }) {
  const { data, error, loading, reload } = useData<Overview>("overview")
  if (loading) return <Loading />
  if (error) return <Failure error={error} retry={reload} />
  if (!data) return <Failure error="Overview is unavailable." retry={reload} />
  const metrics: { label: string; value: number; destination: Destination }[] = [
    { label: "Connected patients", value: data.data.totals.connected_patients, destination: "Patients" },
    { label: "Unread patient messages", value: data.data.totals.unread_messages, destination: "Messages" },
    { label: "Shared assessment results", value: data.data.totals.shared_assessments, destination: "Shared assessment results" },
  ]
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Current totals across all accessible records. Checked {date(data.data.checked_at)}.</p><Button variant="outline" onClick={reload}>Refresh overview</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(metric => <Card key={metric.label}>
      <h2 className="text-sm text-muted-foreground">{metric.label}</h2><p className="my-3 text-3xl font-semibold tabular-nums">{metric.value}</p>
      <Button variant="outline" onClick={() => navigate(metric.destination)}>View {metric.destination.toLowerCase()}</Button>
    </Card>)}</div>
    {metrics.every(metric => metric.value === 0) && <p className="text-sm text-muted-foreground">No connected patients, unread messages or shared results yet. Accept a patient invitation from Patients to get started.</p>}
  </div>
}
