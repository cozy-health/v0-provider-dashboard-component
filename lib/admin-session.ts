import { validCsrf } from "./csrf-server.mjs"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

export const ADMIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cozy-admin" : "cozy-admin"
export const ADMIN_SECONDS = 1800
export type AdminSession = { token: string; expires: number }
const aad = Buffer.from("cozy-admin-session-v1")
function key() {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) throw new Error("Configure a separate ADMIN_SESSION_SECRET.")
  return Buffer.from(secret, "hex")
}
export function sealAdmin(session: AdminSession) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv)
  cipher.setAAD(aad)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")
}
export function openAdmin(value?: string): AdminSession | null {
  if (!value) return null
  try {
    const bytes = Buffer.from(value, "base64url"), decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12))
    decipher.setAAD(aad); decipher.setAuthTag(bytes.subarray(12, 28))
    const session = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"))
    return typeof session.token === "string" && Number.isFinite(session.expires) && session.expires > Date.now() ? session : null
  } catch { return null }
}
export function adminBase() {
  const fallback = process.env.PROVIDER_API_URL?.replace(/provider\/$/, "admin/")
  const url = new URL(process.env.ADMIN_API_URL || fallback || "http://127.0.0.1:8000/api/v1/admin/")
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/api/v1/admin/")) throw new Error("Invalid admin API URL.")
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Admin API requires HTTPS.")
  return url
}
export function validAdminOrigin(request: Request) {
  const expected = process.env.ADMIN_DASHBOARD_ORIGIN || process.env.PROVIDER_DASHBOARD_ORIGIN || (process.env.NODE_ENV !== "production" ? new URL(request.url).origin : null)
  return !!expected && request.headers.get("origin") === expected && request.headers.get("x-cozy-request") === "1" && validCsrf(request)
}
export function adminRoute(path: string, method: string) {
  return method === "GET" && /^(auth\/session|metrics\/(overview|usage|retention|safety))$/.test(path)
    || method === "POST" && /^auth\/(login|logout)$/.test(path)
}
