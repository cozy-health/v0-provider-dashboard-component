import type { Cell } from "@/lib/admin-api"
export function MetricCell({ cell }: { cell: Cell }) {
  if (cell.status === "suppressed") return <span title="Suppressed to protect groups smaller than five or related groups" className="text-muted-foreground">&lt;5</span>
  if (cell.status === "immature") return <span className="text-muted-foreground">Not mature</span>
  if (cell.status === "unavailable") return <span className="text-muted-foreground">Unavailable</span>
  return <span className="tabular-nums font-medium">{cell.count}</span>
}
export function RetentionCell({ cell }: { cell: Cell }) {
  return <span><MetricCell cell={cell} />{cell.status === "available" && <span className="block text-xs text-muted-foreground">of {cell.cohort} · {cell.rate}%</span>}</span>
}
