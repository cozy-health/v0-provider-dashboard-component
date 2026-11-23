import type { Meta } from "@/lib/admin-api"

export function ReportSnapshotInfo({ meta }: { meta: Meta }) {
  const internal = meta.view === "internal"
  const end = new Date(meta.window.to_exclusive)
  if (!internal && Number.isFinite(end.getTime())) end.setTime(end.getTime() - 1)
  const lastDay = Number.isFinite(end.getTime()) ? end.toISOString().slice(0, 10) : "Unavailable"
  const instant = new Date(meta.as_of ?? meta.release)
  const checked = Number.isFinite(instant.getTime())
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", dateStyle: "medium", ...(internal ? { timeStyle: "short" as const } : {}) }).format(instant)
    : "Time unavailable"
  return <div className="report-snapshot-info" role="note" aria-label="Analytics data coverage">
    <span className="report-data-badge">{internal ? "Exact internal counts" : "Protected published report"}</span>
    <span title={`From ${meta.window.from}; through ${meta.window.to_exclusive}, end excluded.`}>{meta.window.from.slice(0, 10)} to {lastDay} · UTC</span>
    <span>{internal ? "Updated" : "Published"} {checked}{internal ? " UTC · refreshes up to once a minute" : ""}</span>
  </div>
}
