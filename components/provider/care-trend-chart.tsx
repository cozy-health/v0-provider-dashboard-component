"use client"

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { InsightBucket } from "@/lib/provider-api"

/** Visual interpolation is decorative; markers and the accompanying table are the recorded values. */
export function CareTrendChart({ buckets, metric, select }: {
  buckets: InsightBucket[]
  metric: "check_ins" | "average_intensity"
  select?: (bucket: InsightBucket) => void
}) {
  const intensity = metric === "average_intensity"
  const label = intensity ? "Average feeling intensity (0–10)" : "Check-ins"
  return <div className="care-trend-chart" role="img" aria-label={`${label} by period. Exact values and inspection controls are in the Period data table below.`}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={buckets} margin={{ top: 20, right: 20, bottom: 8, left: -12 }} onClick={event => {
        const bucket = buckets.find(item => item.label === String(event.activeLabel))
        if (bucket) select?.(bucket)
      }}>
        <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={12} minTickGap={24} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        <YAxis domain={intensity ? [0, 10] : [0, "auto"]} allowDecimals={intensity} axisLine={false} tickLine={false} width={40} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        <Tooltip cursor={{ stroke: "var(--border)", strokeDasharray: "3 4" }} contentStyle={{ borderRadius: 12, background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)", fontSize: 12 }} />
        <Line type="monotone" dataKey={metric} name={label} connectNulls={false} isAnimationActive={false} stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--card)", stroke: "var(--primary)", strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 2, fill: "var(--card)" }} />
      </LineChart>
    </ResponsiveContainer>
  </div>
}
