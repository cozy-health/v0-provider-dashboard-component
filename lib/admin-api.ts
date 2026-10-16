import { mutationHeaders } from "./csrf"
export type Cell = { status: "available" | "suppressed" | "immature" | "unavailable"; count: number | "<5" | null; cohort?: number | "<5" | null; rate?: number | null }
export type Cohort = { week: string; signups: Cell; retention: { d1: Cell; d7: Cell; d30: Cell } }
export type Meta = { release: string; timezone: string; precision: string; activity_definition: string; window: { from: string; to_exclusive: string } }
export type Comparison = { status: "available" | "unavailable"; previous_release: string | null; current_window: { from: string; to_exclusive: string }; previous_window: { from: string; to_exclusive: string } | null; metrics: Record<string, { status: "available" | "unavailable"; previous_count: number | null; change_percent: number | null }> }
export type MetricResponse<T> = { meta: Meta; data: T; comparison?: Comparison }
export class AdminApiError extends Error {
  constructor(message: string, public status: number, public fields: Record<string, string[]> = {}) { super(message) }
}
export async function adminApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, { ...options, cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Cozy-Request": "1", ...options.headers, ...await mutationHeaders(options.method) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if ((response.status === 401 || response.status === 403 && path.startsWith("metrics/")) && path !== "auth/login") window.location.replace("/admin/login?expired=1")
    throw new AdminApiError(data.errors ? Object.entries(data.errors).map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(" ") : "Invalid value"}`).join("\n") : data.message || "Admin data could not be loaded.", response.status, data.errors ?? {})
  }
  return data
}
