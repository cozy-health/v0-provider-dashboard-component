"use client"
import { useEffect, useState } from "react"
import { adminApi, Cell, Cohort, MetricResponse } from "@/lib/admin-api"
import { AdminIcon, moduleVisuals } from "./admin-visuals"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnalyticsBars } from "./admin-workspace"
import { MetricCell, RetentionCell } from "./metric-display"

type Operations = { api: string; database: string; checked_at: string; source: string; availability_history: { status: string }; latency_p95: { status: string }; latency_p99: { status: string }; error_rate: { status: string }; queue_health: { status: string }; deployment: { status: string } }
type Overview = { daily_activity: (Cell & { date: string })[]; signup_trend: (Cell & { week: string })[]; retention_summary: Cohort[]; operations: Operations }
type Usage = { range: string; features: (Cell & { feature: string })[]; unavailable_features: string[] }
type Safety = (Cell & { range: string })[]
type Metric = "overview" | "usage" | "retention" | "safety"
const titles = { overview: "Overview", usage: "Feature usage", retention: "Retention", safety: "Safety signals" }
const featureLabels: Record<string, string> = { mood_entries: "Mood entries", journal_entries: "Published journals", quiz_attempts: "Completed quizzes", app_opens: "App opens", logins: "Logins", crisis_hub_opens: "Crisis hub opens" }

export function MetricsPage({ metric }: { metric: Metric }) {
  const [range, setRange] = useState("30d"), [revision, setRevision] = useState(0)
  return <section><div className="flex flex-wrap gap-4 items-center justify-between mb-6"><div className="flex items-center gap-3"><AdminIcon visual={moduleVisuals[metric]} /><h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{titles[metric]}</h1></div>{metric === "usage" && <label className="flex w-full flex-col gap-2 text-sm sm:w-auto sm:flex-row sm:items-center">Reporting range<select aria-label="Reporting range" value={range} onChange={event => setRange(event.target.value)} className="border rounded-md bg-background p-2">{["7d", "30d", "90d"].map(value => <option key={value}>{value}</option>)}</select></label>}</div><MetricData key={`${metric}:${range}:${revision}`} metric={metric} range={range} retry={() => setRevision(n => n + 1)} /></section>
}
function MetricData({ metric, range, retry }: { metric: Metric; range: string; retry: () => void }) {
  const [state, setState] = useState<{ data?: MetricResponse<Overview | Usage | Cohort[] | Safety>; error?: string }>({})
  useEffect(() => {
    const controller = new AbortController()
    adminApi<MetricResponse<Overview | Usage | Cohort[] | Safety>>(`metrics/${metric}${metric === "usage" ? `?range=${range}` : ""}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ data }) })
      .catch(error => { if (!controller.signal.aborted) setState({ error: error.message }) })
    return () => controller.abort()
  }, [metric, range])
  if (state.error) return <div role="alert" className="rounded-xl border p-6"><p className="text-destructive mb-4">{state.error}</p><Button variant="outline" onClick={retry}><RefreshCw aria-hidden="true" className="size-4" />Try again</Button></div>
  if (!state.data) return <div role="status" className="animate-pulse space-y-3"><p>Loading aggregate metrics…</p><div className="h-24 rounded-lg bg-muted" /><div className="h-48 rounded-lg bg-muted" /></div>
  const { meta, data } = state.data
  return <div className="space-y-6"><aside className="rounded-xl border bg-muted/30 p-4 text-sm"><p>Monthly release: <strong>{meta.release}</strong> · {meta.timezone}</p><p className="mt-1 text-muted-foreground">Window {meta.window.from} through {meta.window.to_exclusive} (end excluded). {meta.precision}</p><p className="mt-2 text-xs text-muted-foreground">{meta.activity_definition}</p><p className="mt-2 text-xs text-muted-foreground">&lt;5 means privacy suppression, including related groups. It does not mean zero. Refreshing preserves the published release.</p></aside>
    {metric === "overview" && <OverviewView data={data as Overview} />}
    {metric === "usage" && <UsageView data={data as Usage} />}
    {metric === "retention" && <RetentionView rows={data as Cohort[]} />}
    {metric === "safety" && <SafetyView rows={data as Safety} />}
  </div>
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border rounded-xl p-5 sm:p-6 bg-card"><h2 className="font-semibold text-lg mb-4">{title}</h2>{children}</section> }
function Empty() { return <p className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground">No reporting buckets are available for this release.</p> }
function Suppressed({ cells }: { cells: Cell[] }) { return cells.length > 0 && cells.every(cell => cell.status !== "available") ? <p role="status" className="text-sm text-muted-foreground mb-4">This view has no publishable counts yet. Groups are suppressed or observation windows are incomplete.</p> : null }
function Trend({ rows, label }: { rows: (Cell & { date?: string; week?: string })[]; label: string }) {
  if (!rows.length) return <Empty />
  const max = Math.max(5, ...rows.filter(row => row.status === "available").map(row => Number(row.count)))
  return <><Suppressed cells={rows} /><div className="space-y-2">{rows.map(row => <div key={row.date || row.week} className="grid grid-cols-[7rem_1fr_3rem] gap-3 items-center text-sm"><span>{row.date || row.week}</span><div className="h-3 rounded bg-muted" aria-hidden="true">{row.status === "available" && <div className="h-3 rounded bg-primary/70" style={{ width: `${Number(row.count) / max * 100}%` }} />}</div><span aria-label={label}><MetricCell cell={row} /></span></div>)}</div></>
}
function OverviewView({ data }: { data: Overview }) {
  const op = data.operations
  return <><div className="grid gap-5 lg:grid-cols-2"><Panel title="Daily active record creators"><Trend rows={data.daily_activity} label="Daily activity" /></Panel><Panel title="Weekly signups"><Trend rows={data.signup_trend} label="Weekly signups" /></Panel></div><Panel title="Current service health"><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div><p className="text-xs text-muted-foreground">API</p><p className="font-semibold">{op.api}</p></div><div><p className="text-xs text-muted-foreground">Database</p><p className="font-semibold">{op.database}</p></div>{[["Historical availability", op.availability_history], ["API P95 latency", op.latency_p95], ["API P99 latency", op.latency_p99], ["Error rate", op.error_rate], ["Queue health", op.queue_health], ["Deployment version", op.deployment]].map(([label]) => <div key={String(label)}><p className="text-xs text-muted-foreground">{String(label)}</p><p className="text-sm">Unavailable</p></div>)}</div><p className="text-xs text-muted-foreground mt-5">Checked {op.checked_at}. {op.source}</p></Panel><RetentionView rows={data.retention_summary} /></>
}
function UsageView({ data }: { data: Usage }) {
  return <Panel title={`Stored feature records ? ${data.range}`}><Suppressed cells={data.features} /><AnalyticsBars rows={data.features.map(row => ({ ...row, label: featureLabels[row.feature] || row.feature }))} /><p className="text-sm text-muted-foreground mt-5">Unavailable: {data.unavailable_features.map(feature => featureLabels[feature] || "Feature").join(", ")}. Anonymous events cannot prove the minimum distinct-user cohort.</p></Panel>
}
function RetentionView({ rows }: { rows: Cohort[] }) {
  return <Panel title="Signup cohorts · D1 / D7 / D30"><p className="text-sm text-muted-foreground mb-4">Returned on the exact UTC calendar day after signup, measured by stored record creation. Cohort weeks start Monday. Counts and rates are rounded; incomplete windows are labeled.</p><Suppressed cells={rows.flatMap(row => Object.values(row.retention))} />{!rows.length ? <Empty /> : <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b">{["Cohort week", "Signups", "D1", "D7", "D30"].map(label => <th key={label} scope="col" className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.week} className="border-b last:border-0"><th scope="row" className="p-3 font-normal whitespace-nowrap">{row.week}</th><td className="p-3"><MetricCell cell={row.signups} /></td>{(["d1", "d7", "d30"] as const).map(day => <td key={day} className="p-3"><RetentionCell cell={row.retention[day]} /></td>)}</tr>)}</tbody></table></div>}</Panel>
}
function SafetyView({ rows }: { rows: Safety }) {
  return <Panel title="Crisis-flagged record counts"><p className="text-sm text-muted-foreground mb-5">Stored flags across moods, published journals and completed quizzes. These are aggregate system signals, not clinical assessments or an emergency queue. No content or individual details are available.</p><Suppressed cells={rows} />{!rows.length ? <Empty /> : <div className="grid gap-4 sm:grid-cols-3">{rows.map(row => <div key={row.range} className="border rounded-lg p-5"><p className="text-sm text-muted-foreground">{row.range} before release</p><p className="text-3xl mt-3"><MetricCell cell={row} /></p></div>)}</div>}</Panel>
}
