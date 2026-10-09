import { randomBytes, timingSafeEqual } from "node:crypto"

export const CSRF_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cozy-csrf" : "cozy-csrf"
export const csrfCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: /** @type {"lax"} */ ("lax"), path: "/", maxAge: 3600 }
export function csrfToken() { return randomBytes(32).toString("hex") }
/** @param {Request} request */
export function validCsrf(request) {
  const cookie = request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${CSRF_COOKIE}=`))?.slice(CSRF_COOKIE.length + 1)
  const header = request.headers.get("x-csrf-token")
  return !!cookie && !!header && /^[a-f0-9]{64}$/.test(cookie) && /^[a-f0-9]{64}$/.test(header) && timingSafeEqual(Buffer.from(cookie), Buffer.from(header))
}
