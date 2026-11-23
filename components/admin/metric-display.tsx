import type { Cell } from "@/lib/admin-api"
export function MetricCell({ cell }: { cell: Cell }) {
  if (cell.status === "suppressed") return <span title="This report withholds small or related groups. It does not mean zero." className="text-muted-foreground">Protected</span>
  if (cell.status === "immature") return <span className="text-muted-foreground">Not mature</span>
  if (cell.status === "unavailable") return <span className="text-muted-foreground">Unavailable</span>
  return <span className="tabular-nums font-medium">{cell.count}</span>
}
export function RetentionCell({ cell }: { cell: Cell }) {
  return <span><MetricCell cell={cell} />{cell.status === "available" && <span className="block text-xs text-muted-foreground">of {cell.cohort} · {cell.rate == null ? "No rate available" : `${cell.rate}%`}</span>}</span>
}
