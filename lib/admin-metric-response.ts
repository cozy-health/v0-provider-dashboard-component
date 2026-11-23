function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// A successful HTTP status must not turn an incomplete report into a crashed page.
export function assertMetricResponse(value: unknown, metric: string): void {
  if (!record(value) || !record(value.meta) || !record(value.meta.window)
    || typeof value.meta.release !== "string" || typeof value.meta.timezone !== "string"
    || typeof value.meta.window.from !== "string" || typeof value.meta.window.to_exclusive !== "string") {
    throw new Error("The analytics response is incomplete. Try again or contact support if this continues.")
  }
  const data = value.data
  const valid = metric === "safety" || metric === "retention" ? Array.isArray(data)
    : metric === "usage" ? record(data) && Array.isArray(data.features)
    : metric === "insights" ? record(data) && record(data.summary) && ["daily", "moods", "triggers", "coping", "helpfulness", "mood_trends", "devices", "enrollments", "completions", "subscription_changes"].every(key => Array.isArray(data[key]))
    : metric === "overview" ? record(data) && Array.isArray(data.daily_activity) && Array.isArray(data.signup_trend) && Array.isArray(data.retention_summary) && record(data.operations)
    : true
  if (!valid) throw new Error("The analytics response is incomplete. Try again or contact support if this continues.")
}
