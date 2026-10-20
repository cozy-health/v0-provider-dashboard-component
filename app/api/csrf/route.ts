import { NextRequest, NextResponse } from "next/server"
import { CSRF_COOKIE, csrfCookieOptions, csrfToken } from "@/lib/csrf-server.mjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export function GET(request: NextRequest) {
  const existing = request.cookies.get(CSRF_COOKIE)?.value
  const token = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : csrfToken()
  const response = NextResponse.json({ token }, { headers: { "Cache-Control": "private, no-store" } })
  response.cookies.set(CSRF_COOKIE, token, csrfCookieOptions)
  return response
}
