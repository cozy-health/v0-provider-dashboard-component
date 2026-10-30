// Public, random request scope. It is never an authentication credential.
export const SCOPE_COOKIE = 'cozy-provider-scope'
export const SCOPE_HEADER = 'X-Cozy-Provider-Scope'
export const validScope = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
export function scopedCookie(name: string, scope: string | null) { return scope ? `${name}.${scope}` : name }
export type CookieReader = { get(name: string): { value: string } | undefined }
export function cookieScope(cookies: CookieReader): string | null {
  const value = cookies.get(SCOPE_COOKIE)?.value
  return validScope(value) ? value : null
}
let bound: string | null | undefined
export function currentBrowserScope(): string | null {
  if (typeof document === 'undefined') return null
  const value = document.cookie.split('; ').find(part => part.startsWith(`${SCOPE_COOKIE}=`))?.slice(SCOPE_COOKIE.length + 1)
  return validScope(value) ? value : null
}
export function browserScope() {
  if (bound === undefined) bound = currentBrowserScope()
  return bound
}
export function assertBrowserScope(expected = browserScope()) {
  if (expected !== currentBrowserScope()) throw new Error('The account changed. Reload this page before continuing.')
}
export function beginBrowserSignIn() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  bound = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  document.cookie = `${SCOPE_COOKIE}=${bound}; Path=/; SameSite=Lax; Max-Age=1209600${location.protocol === 'https:' ? '; Secure' : ''}`
  window.dispatchEvent(new Event('cozy-provider-account'))
  if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('cozy-provider-account'); channel.postMessage('changed'); channel.close() }
  return bound
}