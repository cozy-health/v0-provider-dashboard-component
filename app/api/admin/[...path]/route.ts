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
  if ([...request.nextUrl.searchParams.keys()].some(key => path !== "metrics/usage" || key !== "range")) return error("Only fixed reporting ranges are supported.", 422)
  const range = request.nextUrl.searchParams.get("range")
  if (range && !["7d", "30d", "90d"].includes(range)) return error("Choose 7d, 30d or 90d.", 422)
  const login = path === "auth/login", logout = path === "auth/logout"
  const session = openAdmin(request.cookies.get(ADMIN_COOKIE)?.value)
  if (!login && !session) return clear(error("Your admin session expired. Please sign in again.", 401))
  try {
    let body: string | undefined
    if (method === "POST") {
      if (!request.headers.get("content-type")?.startsWith("application/json")) return error("JSON is required.", 415)
      const reader = request.body?.getReader(), chunks: Uint8Array[] = []; let size = 0
      try {
        if (reader) for (;;) {
          const { done, value } = await reader.read(); if (done) break
          size += value.byteLength
          if (size > 8192) { await reader.cancel(); return error("Request is too large.", 413) }
          chunks.push(value)
        }
      } finally { reader?.releaseLock() }
      let data
      try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { return error("Invalid request.", 400) }
      if (login) { sealAdmin({ token: "configuration-check", expires: 0 }); body = JSON.stringify({ email: data.email, password: data.password }) }
      else body = "{}"
    }
    const target = new URL(path, adminBase()); if (range) target.searchParams.set("range", range)
    const result = await fetch(target, { method, body, headers: { Accept: "application/json", "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.token}` } : {}) }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(60000) })
    if (logout && (result.ok || [401, 403].includes(result.status))) return clear(NextResponse.json({ message: "Signed out." }, { headers }))
    if (!result.ok) {
      const message = login && result.status === 422 ? "Email or password was not accepted for an admin account." : result.status === 429 ? "Too many attempts. Please wait and retry." : [401, 403].includes(result.status) ? "Admin access is unavailable. Please sign in again." : "Admin analytics is temporarily unavailable. Please retry."
      const response = error(message, result.status)
      return !login && [401, 403].includes(result.status) ? clear(response) : response
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
export { handle as GET, handle as POST }
