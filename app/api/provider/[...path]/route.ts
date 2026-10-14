import { NextRequest, NextResponse } from "next/server"
import { allowedRoute, apiBase, openSession, sealSession, SESSION_COOKIE, SESSION_SECONDS, validOrigin } from "@/lib/provider-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" }
const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
function error(message: string, status: number) { return NextResponse.json({ message }, { status, headers: noStore }) }
function clear(response: NextResponse) { response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 }); return response }

async function boundedBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 65536) { await reader.cancel(); return null }
      chunks.push(value)
    }
    return Buffer.concat(chunks).toString("utf8")
  } finally { reader.releaseLock() }
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params
  const path = segments.join("/")
  const method = request.method
  if (method !== "GET" && !validOrigin(request)) return error("Request origin could not be verified.", 403)
  const login = path === "auth/login" && method === "POST"
  const register = path === "auth/register" && method === "POST"
  const publicAuth = login || register || (method === "POST" && ["auth/forgot-password", "auth/reset-password"].includes(path))
  const logout = path === "auth/logout" && method === "POST"
  const download = /^reports\/\d+\/pdf$/.test(path) && method === "GET"
  if (!publicAuth && !logout && !download && !allowedRoute(path, method)) return error("Page not found.", 404)
  let session = openSession(request.cookies.get(SESSION_COOKIE)?.value)
  let refreshed = false
  const renewCookie = (response: NextResponse) => {
    if (refreshed && session) response.cookies.set(SESSION_COOKIE, sealSession(session), { ...cookieOptions, maxAge: Math.max(1, Math.floor((session.expires - Date.now()) / 1000)) })
    return response
  }
  if (!publicAuth && !session) return clear(error("Your session expired. Please sign in again.", 401))
  try {
    const base = apiBase()
    const headers: Record<string, string> = { Accept: "application/json" }
    const userAgent = request.headers.get("user-agent")
    if (userAgent) headers["User-Agent"] = userAgent.slice(0, 1000)
    if (session) headers.Authorization = `Bearer ${session.token}`
    let body: string | undefined
    if (["POST", "PATCH"].includes(method)) {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return error("JSON is required.", 415)
      const raw = await boundedBody(request)
      if (raw === null) return error("Request is too large.", 413)
      let data
      try { data = JSON.parse(raw) } catch { return error("Invalid request.", 400) }
      if (login || register) {
        // Validate encryption configuration before issuing any backend credential.
        sealSession({ token: "configuration-check", expires: Date.now() })
        data = register ? { name: data.name, email: data.email, password: data.password, password_confirmation: data.password_confirmation, practice: data.practice } : { email: data.email, password: data.password, device_name: "cozy-provider-dashboard" }
      }
      body = JSON.stringify(data)
      headers["Content-Type"] = "application/json"
    }
    const upstream = async (url: URL, verb = method, payload = body) => {
      const send = () => fetch(url, { method: verb, headers, body: payload, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(60000) })
      const result = await send()
      if (result.status !== 401 || publicAuth || logout || refreshed || !session?.refreshToken) return result
      const renewal = await fetch(new URL("auth/refresh", base), { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: session.refreshToken }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) })
      if (!renewal.ok) return result
      const pair = (await renewal.json()).data
      if (typeof pair?.token !== "string" || typeof pair?.refresh_token !== "string") return result
      session = { ...session, token: pair.token, refreshToken: pair.refresh_token }
      headers.Authorization = `Bearer ${session.token}`
      refreshed = true
      return send()
    }
    if (download) {
      const id = segments[1]
      const issued = await upstream(new URL(`reports/${id}/download`, base), "GET", undefined)
      if (!issued.ok) return clearIfUnauthorized(error(issued.status === 404 ? "This report is no longer available. Generate a new report with current consent." : "Could not authorize the download.", issued.status), issued.status)
      const data = await issued.json()
      const file = new URL(data.download_url, base.origin)
      if (file.origin !== base.origin || file.pathname !== `${base.pathname}reports/${id}/file` || file.username || file.password || file.hash) return error("Invalid report download.", 502)
      const pdf = await upstream(file, "GET", undefined)
      if (!pdf.ok) return clearIfUnauthorized(error("This report is no longer available. Generate a new report with current consent.", pdf.status), pdf.status)
      if (!pdf.headers.get("content-type")?.startsWith("application/pdf")) return error("Invalid report response.", 502)
      return renewCookie(new NextResponse(await pdf.arrayBuffer(), { headers: { ...noStore, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="provider-report-${id}.pdf"` } }))
    }
    const target = new URL(path, base)
    for (const name of ["page", "per_page", "from", "to", "action", "resource_type"]) {
      const value = request.nextUrl.searchParams.get(name)
      if (value !== null) target.searchParams.set(name, value)
    }
    const result = await upstream(target)
    if (logout) {
      if (!result.ok && result.status !== 401) return error("Sign out could not be completed. Please retry.", 502)
      return clear(NextResponse.json({ message: "Signed out." }, { headers: noStore }))
    }
    const data = await result.json()
    if (!result.ok) {
      if (result.status === 429) {
        const value = result.headers.get("Retry-After")
        const seconds = value && /^\d+$/.test(value) ? Number(value) : 0
        const minutes = Math.max(1, Math.ceil(seconds / 60))
        const response = error(seconds > 0 ? `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` : "Too many attempts. Please wait and retry.", 429)
        if (seconds > 0) response.headers.set("Retry-After", String(seconds))
        return response
      }
      const message = result.status === 404 ? "This data is unavailable or access has changed." : result.status >= 500 ? "The provider service is temporarily unavailable." : data.message || "Request failed."
      return clearIfUnauthorized(NextResponse.json({ message, errors: result.status === 422 ? data.errors : undefined }, { status: result.status, headers: noStore }), result.status)
    }
    if (login || register) {
      if (typeof data.data?.token !== "string" || !data.data?.provider) return error("Invalid sign-in response.", 502)
      const response = NextResponse.json({ provider: data.data.provider }, { status: register ? 201 : 200, headers: noStore })
      response.cookies.set(SESSION_COOKIE, sealSession({ token: data.data.token, refreshToken: data.data.refresh_token, expires: Date.now() + SESSION_SECONDS * 1000 }), { ...cookieOptions, maxAge: SESSION_SECONDS })
      return response
    }
    return renewCookie(NextResponse.json(data, { status: result.status, headers: noStore }))
  } catch { return error("The provider service is temporarily unavailable. Please retry.", 503) }
}
function clearIfUnauthorized(response: NextResponse, status: number) { return status === 401 ? clear(response) : response }
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE }
