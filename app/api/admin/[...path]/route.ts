import { NextRequest, NextResponse } from "next/server"
import { ADMIN_COOKIE, ADMIN_SECONDS, adminBase, adminRoute, openAdmin, sealAdmin, validAdminOrigin } from "@/lib/admin-session"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" }
function error(message: string, status: number) { return NextResponse.json({ message }, { status, headers }) }
function clear(response: NextResponse) { response.cookies.set(ADMIN_COOKIE, "", { ...cookieOptions, maxAge: 0 }); return response }

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join("/"), method = request.method
  if (method !== "GET" && !validAdminOrigin(request)) return error("Request origin could not be verified.", 403)
  if (!adminRoute(path, method)) return error("Page not found.", 404)
  const metric = path.startsWith("metrics/")
  const list = /^(articles|age-cases|student-applications|users|quizzes|reports|support|subscriptions(?:\/history)?|emails|content\/[a-z]+|community\/(posts|comments|members))$/.test(path)
  const allowed = path === "development-access" && method === "GET" ? ["page"] : ["metrics/usage", "metrics/insights"].includes(path) ? ["range"] : list && method === "GET" ? ["search", "page", "per_page", ...(["reports", "support", "student-applications"].includes(path) ? ["status", ...(path === "reports" ? ["overdue"] : [])] : []), ...(path.startsWith("community/") ? ["group_id"] : [])] : []
  if ([...request.nextUrl.searchParams.keys()].some(key => !allowed.includes(key))) return error(metric ? "Only fixed reporting ranges are supported." : "Unsupported filter.", 422)
  const range = request.nextUrl.searchParams.get("range")
  if (range && !["7d", "30d", "90d"].includes(range)) return error("Choose 7d, 30d or 90d.", 422)
  const login = path === "auth/login", logout = path === "auth/logout"
  const session = openAdmin(request.cookies.get(ADMIN_COOKIE)?.value)
  if (!login && !session) return clear(error("Your admin session expired. Please sign in again.", 401))
  try {
    let body: string | undefined
    if (!["GET", "HEAD"].includes(method)) {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return error("JSON is required.", 415)
      const reader = request.body?.getReader(), chunks: Uint8Array[] = []; let size = 0
      try {
        if (reader) for (;;) {
          const { done, value } = await reader.read(); if (done) break
          size += value.byteLength
          if (size > (login ? 8192 : 262144)) { await reader.cancel(); return error("Request is too large.", 413) }
          chunks.push(value)
        }
      } finally { reader?.releaseLock() }
      let data
      try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { return error("Invalid request.", 400) }
      if (!data || typeof data !== "object" || Array.isArray(data)) return error("A JSON object is required.", 400)
      if (login) { sealAdmin({ token: "configuration-check", expires: 0 }); body = JSON.stringify({ email: data.email, password: data.password, session_mode: "management-v1" }) }
      else body = logout ? "{}" : JSON.stringify(data)
    }
    const target = new URL(path, adminBase()); request.nextUrl.searchParams.forEach((value, key) => target.searchParams.set(key, value))
    const result = await fetch(target, { method, body, headers: { Accept: "application/json", "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.token}` } : {}) }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(60000) })
    if (logout && (result.ok || [401, 403].includes(result.status))) return clear(NextResponse.json({ message: "Signed out." }, { headers }))
    if (!result.ok) {
      if (result.status === 422 && !login) {
        const validation = await result.json().catch(() => ({}))
        const errors = Object.fromEntries(Object.entries(validation.errors ?? {}).filter(([key, value]) => /^[a-zA-Z0-9_.]+$/.test(key) && Array.isArray(value) && value.every(item => typeof item === "string")))
        return NextResponse.json({ message: "Check the submitted fields.", errors }, { status: 422, headers })
      }
      const message = login && result.status === 422 ? "Email or password was not accepted for an admin account." : result.status === 429 ? "Too many attempts. Please wait and retry." : result.status === 404 && /^(reports|support)\/\d+$/.test(path) ? "This record is no longer available." : result.status === 409 ? "This record has changed. Reload it and retry." : result.status === 403 ? "This action requires an authorized admin session." : result.status === 401 ? "Admin access is unavailable. Please sign in again." : "Admin service is temporarily unavailable. Please retry."
      const response = error(message, result.status)
      return !login && (result.status === 401 || result.status === 403 && (metric || path === "auth/session")) ? clear(response) : response
    }
    if (/^student-applications\/[a-f0-9-]{36}\/evidence$/.test(path)) {
      const bytes = await result.arrayBuffer()
      if (bytes.byteLength > 4 * 1024 * 1024) return error("Evidence exceeds the download limit.", 413)
      return new NextResponse(bytes, { headers: { ...headers, "Content-Type": "application/octet-stream", "Content-Disposition": "attachment; filename=enrolment-evidence", "Referrer-Policy": "no-referrer" } })
    }
    const data = await result.json()
    if (login) {
      const expires = Date.parse(data.expires_at)
      if (typeof data.token !== "string" || !Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + ADMIN_SECONDS * 1000 + 1000) return error("Invalid sign-in response.", 502)
      const response = NextResponse.json({ role: "admin" }, { headers })
      response.cookies.set(ADMIN_COOKIE, sealAdmin({ token: data.token, expires }), { ...cookieOptions, maxAge: Math.max(1, Math.floor((expires - Date.now()) / 1000)) })
      return response
    }
    return NextResponse.json(data, { headers })
  } catch { return error("Admin analytics is temporarily unavailable. Please retry.", 503) }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE }
