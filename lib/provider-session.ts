import { validCsrf } from "./csrf-server.mjs"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

export const SESSION_SECONDS = 1800
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cozy-provider" : "cozy-provider"
export type ProviderSession = { token: string; refreshToken?: string; expires: number }

function key() {
  const secret = process.env.PROVIDER_SESSION_SECRET
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) throw new Error("Configure PROVIDER_SESSION_SECRET with 32 random bytes in hex.")
  return Buffer.from(secret, "hex")
}

export function sealSession(session: ProviderSession) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")
}

export function openSession(value?: string): ProviderSession | null {
  if (!value) return null
  try {
    const bytes = Buffer.from(value, "base64url")
    const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12))
    decipher.setAuthTag(bytes.subarray(12, 28))
    const session = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"))
    return typeof session.token === "string" && Number.isFinite(session.expires) && session.expires > Date.now() ? session : null
  } catch { return null }
}

export function apiBase() {
  const url = new URL(process.env.PROVIDER_API_URL || "http://127.0.0.1:8000/api/v1/provider/")
  if (url.username || url.password || url.search || url.hash || !/^https?:$/.test(url.protocol)) throw new Error("Invalid provider API URL.")
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Provider API requires HTTPS in production.")
  if (!url.pathname.endsWith("/api/v1/provider/")) throw new Error("Provider API URL must end in /api/v1/provider/.")
  return url
}

// Only the existing provider contract can be reached through the bridge.
export function allowedRoute(path: string, method: string) {
  const rules: [RegExp, string[]][] = [
    [/^audio-attachments$/, ["POST"]],
    [/^audio-attachments\/[a-f0-9-]{36}$/, ["GET"]],
    [/^conversations$/, ["GET"]],
    [/^conversations\/\d+\/messages$/, ["GET", "POST"]],
    [/^conversations\/\d+\/read$/, ["POST"]],
    [/^conversations\/\d+\/journal-shares\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/, ["GET"]],
    [/^invitations\/(preview|connect)$/, ["POST"]],
    [/^me$/, ["GET", "PATCH"]], [/^clients$/, ["GET"]],
    [/^consent-config$/, ["GET"]], [/^me\/consents$/, ["GET", "POST"]],
    [/^clients\/\d+$/, ["GET"]],
    [/^clients\/\d+\/(moods|journals|quizzes|consents)$/, ["GET"]],
    [/^clients\/\d+\/(notes|resources)$/, ["GET", "POST"]],
    [/^clients\/\d+\/(notes|resources)\/\d+$/, ["DELETE"]],
    [/^resources$/, ["GET", "POST"]], [/^resources\/\d+$/, ["PATCH", "DELETE"]],
    [/^reports$/, ["GET", "POST"]], [/^reports\/\d+(\/download)?$/, ["GET"]],
    [/^quiz-shares$/, ["GET"]], [/^quiz-shares\/\d+$/, ["GET"]],
    [/^access-log$/, ["GET"]],
  ]
  return rules.some(([pattern, methods]) => pattern.test(path) && methods.includes(method))
}

export function validOrigin(request: Request) {
  const expected = process.env.PROVIDER_DASHBOARD_ORIGIN || (process.env.NODE_ENV !== "production" ? new URL(request.url).origin : null)
  return !!expected && request.headers.get("origin") === expected && request.headers.get("x-cozy-request") === "1" && validCsrf(request)
}
