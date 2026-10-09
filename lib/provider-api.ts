export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter = 0) { super(message) }
}

// A full document navigation discards patient data in React memory on auth changes.
export function freshNavigation(path: string) { window.location.replace(new URL(path, window.location.origin).href) }

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/provider/${path}`, { ...options, cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Cozy-Request": "1", ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401) freshNavigation("/login?expired=1")
    const validation = data.errors ? Object.values(data.errors).flat().join(" ") : null
    const retryAfter = Number(response.headers.get("Retry-After"))
    throw new ApiError(response.status, validation || data.message || "Request failed. Please retry.", Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 0)
  }
  return data as T
}

export type Provider = { id: number; name: string; email: string; practice: string | null; timezone: string; is_verified: boolean; license_number: string | null; license_state: string | null }
export type ConsentType = "moods" | "journals" | "quizzes" | "notes"
export type Client = { user_id: number; name: string; linked_at: string; consent_flags: Record<ConsentType, boolean>; gender?: string; date_of_birth?: string }
export type Page<T> = { data: T[]; current_page: number; last_page: number; total: number }
export type Mood = { id: string; mood: string; intensity: number; triggers: string[] | null; custom_trigger: string | null; coping_strategies: string[] | null; coping_helped: string | null; client_created_at: string | null; created_at: string }
export type Journal = { id: string; title: string | null; type: string; word_count: number; has_voice: boolean; created_at: string }
export type Quiz = { id: string; quiz_slug: string; score: number; interpretation: string; completed_at: string }
export type Note = { id: number; body: string; created_at: string }
export type Resource = { id: number; title: string; type: string; duration_minutes: number | null; description: string | null; url: string | null }
export type Assignment = { id: number; resource: Resource; status: string; notes: string | null; assigned_at: string }
export type Report = { id: number; user_id: number; type: string; period_start: string; period_end: string; generated_at: string }
export type AccessLog = { id: number; user_id: number | null; action: string; resource_type: string; resource_id: string | null; created_at: string; ip_address: string | null }
