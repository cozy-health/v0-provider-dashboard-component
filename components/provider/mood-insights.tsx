"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { type InsightBucket, type InsightPeriodKey, type Mood, type MoodInsights as MoodInsightsData } from "@/lib/provider-api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, DataList, Empty, Failure, Loading, date, useData } from "./data-list"

const periods: { key: InsightPeriodKey; label: string }[] = [{ key: "week", label: "Week" }, { key: "month", label: "This month" }, { key: "year", label: "This year" }]

function priorityLabel(data: MoodInsightsData) {
  const value = data.current_priority
  if (value.level) return `${value.level[0]?.toUpperCase()}${value.level.slice(1)} priority`
  return value.status === "no_negative" ? "No negative days" : "No check-ins"
}

function priorityVariant(data: MoodInsightsData): "default" | "secondary" | "outline" | "destructive" {
  if (data.current_priority.level === "high") return "destructive"
  if (data.current_priority.level === "moderate") return "default"
  return data.current_priority.level === "low" ? "secondary" : "outline"
}

export function MoodInsights({ userId, enabled }: { userId: number; enabled: boolean }) {
  const [period, setPeriod] = useState<InsightPeriodKey>("week")
  const [selected, setSelected] = useState<InsightBucket | null>(null)
  useEffect(() => setSelected(null), [period])
  if (!enabled) return <Empty>Mood sharing is off. No priority, summary, dates, or mood-derived information is available.</Empty>
  return <MoodInsightsPeriod userId={userId} period={period} setPeriod={setPeriod} selected={selected} setSelected={setSelected} />
}

function MoodInsightsPeriod({ userId, period, setPeriod, selected, setSelected }: { userId: number; period: InsightPeriodKey; setPeriod: (period: InsightPeriodKey) => void; selected: InsightBucket | null; setSelected: (bucket: InsightBucket | null) => void }) {
  const { data: response, error, loading, reload } = useData<{ data: MoodInsightsData }>(`clients/${userId}/insights?period=${period}`)
  if (loading) return <Loading />
  if (error) return <Failure error={error} retry={reload} />
  if (!response) return <Failure error="Patient insights are unavailable." retry={reload} />
  const data = response.data
  const selectChartBucket = (chart: { activeLabel?: string | number }) => { const bucket = data.buckets.find(item => item.label === String(chart.activeLabel)); if (bucket) setSelected(bucket) }
  const trendDetail = data.trend?.intensity_change == null ? "Recorded intensity, not mood valence" : `${data.trend.intensity_change > 0 ? "+" : ""}${data.trend.intensity_change} from ${data.trend.previous_bucket} to ${data.trend.latest_bucket}`
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="group" aria-label="Insight period">{periods.map(option => <Button key={option.key} variant={period === option.key ? "default" : "outline"} aria-pressed={period === option.key} onClick={() => setPeriod(option.key)}>{option.label}</Button>)}</div><Button variant="outline" onClick={reload}>Refresh insights</Button></div>
    <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-semibold">{data.period.label} insights</h3><p className="mt-1 text-sm text-muted-foreground">{data.period.start} to {data.period.end} · {data.period.timezone}</p></div><Badge variant={priorityVariant(data)}>{priorityLabel(data)}</Badge></div><p className="mt-4 text-sm">{data.current_priority.explanation}</p><p className="mt-1 text-xs text-muted-foreground">Current follow-up priority always uses the latest seven days, including today.</p></Card>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Check-ins" value={data.coverage.check_ins} detail={`${data.coverage.recorded_days} of ${data.coverage.possible_days} days logged`} /><Metric label="Negative" value={data.counts.negative} /><Metric label="Positive" value={data.counts.positive} /><Metric label="Average intensity" value={data.average_intensity ?? "—"} detail={trendDetail} /></div>
    {!data.coverage.check_ins ? <Empty>No shared mood check-ins were recorded in this period.</Empty> : <>
      <Card><h4 className="mb-1 font-medium">Check-in frequency</h4><p className="mb-3 text-xs text-muted-foreground">Select a bar or use the table below to inspect its supporting records.</p><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.buckets} onClick={selectChartBucket}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)" }} minTickGap={18} /><YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)" }} /><Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} /><Bar dataKey="check_ins" name="Check-ins" fill="var(--chart-1)" cursor="pointer" /></BarChart></ResponsiveContainer></div></Card>
      <Card><h4 className="mb-3 font-medium">Intensity pattern</h4><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.buckets}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)" }} minTickGap={18} /><YAxis domain={[0, 10]} tick={{ fill: "var(--muted-foreground)" }} /><Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} /><Line isAnimationActive={false} connectNulls={false} dataKey="average_intensity" name="Average intensity" stroke="var(--chart-2)" /></LineChart></ResponsiveContainer></div></Card>
      <div className="grid gap-4 lg:grid-cols-3"><Distribution title="Mood labels" rows={data.moods} /><Distribution title="Top triggers" rows={data.triggers} /><Distribution title="Coping usage" rows={data.coping_strategies} /></div>
    </>}
    <BucketTable buckets={data.buckets} select={setSelected} />
    {selected && <BucketRecords userId={userId} bucket={selected} close={() => setSelected(null)} />}
  </div>
}

function Metric({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return <Card><p className="text-sm text-muted-foreground">{label}</p><p className="my-2 text-2xl font-semibold tabular-nums">{value}</p>{detail && <p className="text-xs text-muted-foreground">{detail}</p>}</Card>
}

function Distribution({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  return <Card><h4 className="mb-3 font-medium">{title}</h4>{rows.length ? <ul className="space-y-2">{rows.map(row => <li key={row.name} className="flex justify-between gap-3 text-sm"><span className="capitalize">{row.name}</span><span className="tabular-nums">{row.count}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Nothing recorded.</p>}</Card>
}

function BucketTable({ buckets, select }: { buckets: InsightBucket[]; select: (bucket: InsightBucket) => void }) {
  return <Card><h4 className="mb-3 font-medium">Period data</h4><div className="overflow-x-auto"><table className="w-full min-w-[46rem] text-left text-sm"><thead><tr className="border-b"><th className="p-2">Period</th><th className="p-2">Check-ins</th><th className="p-2">Negative</th><th className="p-2">Positive</th><th className="p-2">Neutral</th><th className="p-2">Unclassified</th><th className="p-2">Intensity</th><th className="p-2"><span className="sr-only">Action</span></th></tr></thead><tbody>{buckets.map(bucket => <tr key={bucket.key} className="border-b last:border-0"><td className="p-2">{bucket.label}</td><td className="p-2">{bucket.check_ins}</td><td className="p-2">{bucket.negative}</td><td className="p-2">{bucket.positive}</td><td className="p-2">{bucket.neutral}</td><td className="p-2">{bucket.unclassified}</td><td className="p-2">{bucket.average_intensity ?? "—"}</td><td className="p-2"><Button variant="outline" size="sm" disabled={!bucket.check_ins} onClick={() => select(bucket)}>Inspect {bucket.label}</Button></td></tr>)}</tbody></table></div></Card>
}

function BucketRecords({ userId, bucket, close }: { userId: number; bucket: InsightBucket; close: () => void }) {
  const path = `clients/${userId}/moods?from=${encodeURIComponent(bucket.start)}&to=${encodeURIComponent(bucket.end)}`
  return <section className="space-y-4" aria-labelledby="supporting-records"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 id="supporting-records" className="text-lg font-semibold">Supporting records · {bucket.label}</h4><p className="text-sm text-muted-foreground">{bucket.start} to {bucket.end}</p></div><Button variant="outline" onClick={close}>Back to summary</Button></div><DataList<Mood> path={path} empty="No supporting mood records are available." render={entry => <Card><div className="flex flex-wrap justify-between gap-2"><h5 className="font-medium capitalize">{entry.mood} · Intensity {entry.intensity}/10</h5><span className="text-xs text-muted-foreground">{date(entry.client_created_at || entry.created_at)}</span></div><p className="mt-2 text-sm">Triggers: {[...(entry.triggers || []), ...(entry.custom_trigger ? [entry.custom_trigger] : [])].join(", ") || "None recorded"}</p><p className="mt-1 text-sm">Coping: {entry.coping_strategies?.join(", ") || "None recorded"}{entry.coping_helped && <span> · Feedback: {entry.coping_helped}</span>}</p></Card>} /></section>
}
