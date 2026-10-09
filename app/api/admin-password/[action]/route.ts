import { NextRequest, NextResponse } from "next/server"
import { adminBase, validAdminOrigin } from "@/lib/admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
function reply(message: string, status = 200) { return NextResponse.json({ message }, { status, headers }) }

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  if (!validAdminOrigin(request)) return reply("Request origin could not be verified.", 403)
  const { action } = await context.params
  if (!["forgot-password", "reset-password"].includes(action)) return reply("Page not found.", 404)
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply("JSON is required.", 415)
  try {
    const reader = request.body?.getReader(), chunks: Uint8Array[] = []
    let size = 0
    try {
      if (reader) for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 8192) { await reader.cancel(); return reply("Request is too large.", 413) }
        chunks.push(value)
      }
    } finally { reader?.releaseLock() }
    let data
    try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { return reply("Invalid request.", 400) }
    if (!data || typeof data.email !== "string" || data.email.length > 190) return reply("Enter a valid email.", 422)
    const body = action === "forgot-password" ? { email: data.email } : { email: data.email, token: data.token, password: data.password }
    if (action === "reset-password" && (typeof data.token !== "string" || !/^\d{6}$/.test(data.token) || typeof data.password !== "string" || data.password.length < 12 || data.password.length > 255)) return reply("Enter a six-digit code and a password of 12–255 characters.", 422)
    const result = await fetch(new URL(`../auth/${action}`, adminBase()), {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000),
    })
    if (result.status === 429) {
      const value = result.headers.get("Retry-After")
      const seconds = value && /^\d+$/.test(value) ? Number(value) : 0
      const minutes = Math.max(1, Math.ceil(seconds / 60))
      const response = reply(seconds > 0 ? `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}. Check your inbox and spam folder for a code already sent.` : "Too many attempts. Please wait and retry.", 429)
      if (seconds > 0) response.headers.set("Retry-After", String(seconds))
      return response
    }
    if (!result.ok) return reply(action === "reset-password" && [400, 404, 422].includes(result.status) ? "The reset code or password was not accepted. Request a new code and retry." : "Password reset is temporarily unavailable. Please retry.", action === "forgot-password" ? 503 : result.status)
    return reply(action === "forgot-password" ? "If an account exists with that email, you'll receive a reset code." : "Password reset. Log in with your new one.")
  } catch { return reply("Password reset is temporarily unavailable. Please retry.", 503) }
}
