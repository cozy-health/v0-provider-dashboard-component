import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { apiBase, openValue, sealValue, openSession, sealSession, SESSION_COOKIE, SESSION_SECONDS, type ProviderSession } from './provider-session'
import { cookieScope, scopedCookie, SCOPE_HEADER } from './provider-auth-scope'

const secretCookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' }
const noStore = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
const pendingName = `${SESSION_COOKIE}-pending`
const proofName = `${SESSION_COOKIE}-device`
const tokenPattern = /^[a-f0-9]{64}$/
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const emailKey = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
type Challenge = { token: string; method: 'email' | 'questions'; expires: number; questions: { id: string; prompt: string }[]; delivery: string | null }
type Pending = { expires: number; stage: 'challenge' | 'enrollment' | 'identity' | 'settings-code' | 'ready'; settings: boolean; email: string; accountId?: string; challenge?: Challenge; session?: ProviderSession; ticket?: string }
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: noStore }) }
class ProtectionFailure extends Error { constructor(message: string, public status = 502, public retry = 0) { super(message) } }
function challenge(data: Record<string, unknown>): Challenge {
  const expires = typeof data.expires_at === 'string' ? Date.parse(data.expires_at) : NaN
  const questions: Challenge['questions'] = []
  if (Array.isArray(data.questions)) for (const value of data.questions) {
    if (!record(value) || typeof value.id !== 'string' || !value.id || value.id.length > 100 || typeof value.prompt !== 'string' || !value.prompt || value.prompt.length > 300) throw new ProtectionFailure('Invalid security questions.')
    questions.push({ id: value.id, prompt: value.prompt })
  }
  if (typeof data.challenge_token !== 'string' || !tokenPattern.test(data.challenge_token) || !['email', 'questions'].includes(String(data.method)) || !Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 601000 || (data.method === 'questions' && (questions.length !== 2 || new Set(questions.map(q => q.id)).size !== 2))) throw new ProtectionFailure('Invalid sign-in check.')
  const delivery = typeof data.email_delivery === 'string' && ['queued', 'failed', 'unavailable'].includes(data.email_delivery) ? data.email_delivery : null
  return { token: data.challenge_token, method: data.method === 'questions' ? 'questions' : 'email', expires, questions: data.method === 'questions' ? questions : [], delivery }
}
function readPending(request: NextRequest, scope: string): Pending | null {
  const value = openValue(request.cookies.get(scopedCookie(pendingName, scope))?.value, `provider-protection:${scope}`)
  if (!record(value) || typeof value.expires !== 'number' || value.expires <= Date.now() || typeof value.settings !== 'boolean' || typeof value.email !== 'string' || !['challenge', 'enrollment', 'identity', 'settings-code', 'ready'].includes(String(value.stage))) return null
  // Only authenticated, purpose-bound server cookies can reach this typed state.
  return value as Pending
}
function writePending(response: NextResponse, scope: string, state: Pending | null) {
  response.cookies.set(scopedCookie(pendingName, scope), state ? sealValue(state, `provider-protection:${scope}`) : '', { ...secretCookie, maxAge: state ? Math.max(1, Math.ceil((state.expires - Date.now()) / 1000)) : 0 })
  return response
}
function publicState(state: Pending) {
  return { protection_required: true, stage: state.stage, settings: state.settings, expires_at: new Date(state.expires).toISOString(), method: state.challenge?.method, questions: state.challenge?.questions ?? [], email_delivery: state.challenge?.delivery ?? null }
}
// Retire only cookie names present when this sign-in began. A delayed response
// cannot erase a newer scope created after its request snapshot.
export function retirePreviousScopes(request: NextRequest, response: NextResponse, scope: string) {
  for (const cookie of request.cookies.getAll()) {
    const sessionSuffix = cookie.name.startsWith(`${SESSION_COOKIE}.`) ? cookie.name.slice(SESSION_COOKIE.length + 1) : ''
    const pendingSuffix = cookie.name.startsWith(`${pendingName}.`) ? cookie.name.slice(pendingName.length + 1) : ''
    if (cookie.name === SESSION_COOKIE || (tokenPattern.test(sessionSuffix) && sessionSuffix !== scope) || (tokenPattern.test(pendingSuffix) && pendingSuffix !== scope)) response.cookies.set(cookie.name, '', { ...secretCookie, maxAge: 0 })
  }
  return response
}
export function rememberedProof(request: NextRequest, email: string): string | undefined {
  const value = openValue(request.cookies.get(`${proofName}.${emailKey(email)}`)?.value, `provider-device:${emailKey(email)}`)
  return record(value) && typeof value.proof === 'string' && tokenPattern.test(value.proof) && typeof value.expires === 'number' && value.expires > Date.now() ? value.proof : undefined
}
export function rememberProof(response: NextResponse, session: ProviderSession) {
  if (!session.email || !session.deviceProof) return response
  const key = emailKey(session.email)
  response.cookies.set(`${proofName}.${key}`, sealValue({ proof: session.deviceProof, expires: Date.now() + 1209600000 }, `provider-device:${key}`), { ...secretCookie, maxAge: 1209600 })
  return response
}
export function beginProtection(request: NextRequest, data: Record<string, unknown>, email: string): NextResponse | null {
  if (data.challenge_required !== true) return null
  const scope = cookieScope(request.cookies)
  if (!scope || request.headers.get(SCOPE_HEADER) !== scope) return json({ message: 'Reload this page before starting sign-in protection.' }, 409)
  const check = challenge(data)
  const state: Pending = { stage: 'challenge', settings: false, email: email.trim().toLowerCase(), challenge: check, expires: check.expires }
  return retirePreviousScopes(request, writePending(json(publicState(state)), scope, state), scope)
}
async function upstream(path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown, session?: ProviderSession): Promise<Record<string, unknown>> {
  const result = await fetch(new URL(path, apiBase()), { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) })
  const value: unknown = await result.json().catch(() => null)
  if (!result.ok) {
    const retry = Number(result.headers.get('Retry-After'))
    const message = result.status >= 500 ? 'The provider service is temporarily unavailable.' : record(value) && typeof value.message === 'string' && value.message.length <= 300 ? value.message : 'The security check was not accepted.'
    throw new ProtectionFailure(message, result.status, Number.isInteger(retry) && retry > 0 && retry <= 86400 ? retry : result.status === 429 ? 60 : 0)
  }
  if (!record(value) || !record(value.data)) throw new ProtectionFailure('Invalid security response.')
  return value.data
}
async function preferences(state: Pending) {
  if (!state.session) throw new ProtectionFailure('Start sign-in again.', 410)
  const data = await upstream('auth/security', 'GET', undefined, state.session)
  if (typeof data.enabled !== 'boolean' || typeof data.enrolled !== 'boolean' || !['email', 'questions'].includes(String(data.method)) || !record(data.questions)) throw new ProtectionFailure('Invalid protection settings.')
  const questions = Object.entries(data.questions).map(([id, prompt]) => {
    if (!id || id.length > 100 || typeof prompt !== 'string' || !prompt || prompt.length > 300) throw new ProtectionFailure('Invalid question catalog.')
    return { id, prompt }
  })
  return { enabled: data.enabled, enrolled: data.enrolled, method: data.method === 'questions' ? 'questions' as const : 'email' as const, questions }
}
export async function protectionRequest(request: NextRequest): Promise<NextResponse> {
  const scope = cookieScope(request.cookies)
  if (!scope || request.headers.get(SCOPE_HEADER) !== scope) return json({ message: 'The account changed. Reload this page.' }, 409)
  let state = readPending(request, scope)
  try {
    if (!['GET', 'POST'].includes(request.method)) return json({ message: 'Method not allowed.' }, 405)
    let input: Record<string, unknown> = {}
    if (request.method === 'POST') {
      const reader = request.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0
      if (reader) try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 12000) { await reader.cancel(); return json({ message: 'Request is too large.' }, 413) } chunks.push(value) } } finally { reader.releaseLock() }
      const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!record(parsed)) return json({ message: 'Invalid request.' }, 400)
      input = parsed
    }
    const action = input.action
    if (action === 'settings') {
      const session = openSession(request.cookies.get(scopedCookie(SESSION_COOKIE, scope))?.value, scope)
      if (!session?.email) return json({ message: 'Sign in again before changing protection.' }, 401)
      state = { expires: Date.now() + 600000, stage: 'identity', settings: true, session, email: session.email }
    }
    if (action === 'cancel') {
      if (state && !state.settings && state.session) await upstream('auth/logout', 'POST', {}, state.session).catch(() => undefined)
      return writePending(json({ cancelled: true }), scope, null)
    }
    if (!state) return json({ message: 'This security check ended. Start sign-in again.' }, 404)
    if (action === 'identity') {
      if (!state.session || typeof input.password !== 'string' || !input.password || input.password.length > 255) return json({ message: 'Enter your current password.' }, 422)
      const check = challenge(await upstream('auth/security/reauthenticate', 'POST', { password: input.password }, state.session))
      if (check.method !== 'email') throw new ProtectionFailure('Settings require an email check.')
      state = { ...state, stage: 'settings-code', challenge: check, expires: check.expires, ticket: undefined }
    } else if (action === 'resend') {
      if (!state.challenge || !['challenge', 'settings-code'].includes(state.stage)) return json({ message: 'Start a new security check.' }, 410)
      const next = challenge(await upstream('auth/challenge/resend', 'POST', { challenge_token: state.challenge.token }))
      if (next.token !== state.challenge.token || next.expires > state.challenge.expires + 1000) throw new ProtectionFailure('The security check changed unexpectedly.')
      state = { ...state, challenge: next }
    } else if (action === 'verify') {
      if (!state.challenge || !['challenge', 'settings-code'].includes(state.stage)) return json({ message: 'Start a new security check.' }, 410)
      const answers = input.answers
      if (state.challenge.method === 'email' ? typeof input.code !== 'string' || !/^\d{6}$/.test(input.code) : !record(answers) || state.challenge.questions.some(q => typeof answers[q.id] !== 'string' || !(answers[q.id] as string).trim() || (answers[q.id] as string).length > 200)) return json({ message: 'Enter the code or both answers.' }, 422)
      const data = await upstream('auth/challenge/verify', 'POST', { challenge_token: state.challenge.token, ...(state.challenge.method === 'email' ? { code: input.code } : { answers }) })
      if (state.stage === 'settings-code') {
        if (data.verified !== true || typeof data.security_settings_token !== 'string' || !tokenPattern.test(data.security_settings_token)) throw new ProtectionFailure('Invalid identity verification.')
        state = { ...state, stage: 'enrollment', ticket: data.security_settings_token, challenge: undefined }
      } else {
        const owner = data.provider
        if (data.challenge_required !== false || typeof data.security_enrollment_required !== 'boolean' || !record(owner) || String(owner.email).trim().toLowerCase() !== state.email || !['number', 'string'].includes(typeof owner.id) || typeof data.token !== 'string' || !data.token || typeof data.refresh_token !== 'string' || !tokenPattern.test(data.refresh_token) || typeof data.device_proof !== 'string' || !tokenPattern.test(data.device_proof)) throw new ProtectionFailure('The verified account did not match this sign-in.')
        const ticket = typeof data.security_settings_token === 'string' && tokenPattern.test(data.security_settings_token) ? data.security_settings_token : undefined
        if (data.security_enrollment_required && !ticket) throw new ProtectionFailure('Enrollment verification is missing.')
        state = { ...state, stage: data.security_enrollment_required ? 'enrollment' : 'ready', accountId: String(owner.id), challenge: undefined, ticket, session: { token: data.token, refreshToken: data.refresh_token, deviceProof: data.device_proof, email: state.email, expires: Date.now() + SESSION_SECONDS * 1000 } }
      }
      // Persist only encrypted provisional state. Loading preferences can be retried without replaying a consumed code.
      return writePending(json(publicState(state)), scope, state)
    } else if (action === 'save') {
      if (!state.session || !state.ticket || state.stage !== 'enrollment') return json({ message: 'Confirm your identity before saving.' }, 403)
      if (!['questions', 'email'].includes(String(input.method))) return json({ message: 'Choose a protection method.' }, 422)
      const current = await preferences(state)
      if (!current.enabled) return json({ message: 'Protection changes are not available yet.' }, 409)
      const questions = input.questions
      if (input.method === 'questions' && (!Array.isArray(questions) || questions.length !== 3 || new Set(questions.filter(record).map(q => q.id)).size !== 3 || questions.some(q => !record(q) || !current.questions.some(known => known.id === q.id) || typeof q.answer !== 'string' || Array.from(q.answer.trim().replace(/\s+/g, ' ')).length < 3 || Array.from(q.answer.trim().replace(/\s+/g, ' ')).length > 200))) return json({ message: 'Choose three different questions with secret answers of 3 to 200 characters.' }, 422)
      try {
        const saved = await upstream('auth/security', 'PUT', { method: input.method, security_settings_token: state.ticket, ...(input.method === 'questions' ? { questions } : {}) }, state.session)
        if (saved.enrolled !== true || saved.method !== input.method) throw new ProtectionFailure('The saved setting was not confirmed.')
        state = { ...state, stage: 'ready', ticket: undefined }
      } catch (error) {
        if (error instanceof ProtectionFailure && error.status < 500 && error.status !== 409) throw error
        state = { ...state, ticket: undefined }
        return writePending(json({ ...publicState(state), uncertain: true, message: 'The save response was lost. Check saved protection before continuing.' }, 503), scope, state)
      }
    } else if (action === 'reconcile') {
      state = { ...state, ticket: undefined }
    } else if (action === 'complete') {
      const saved = await preferences(state)
      if (!saved.enabled || !saved.enrolled || !state.session) return json({ message: 'Finish protection enrollment before continuing.' }, 403)
      const response = writePending(json({ complete: true, settings: state.settings }), scope, null)
      if (!state.settings) {
        response.cookies.set(scopedCookie(SESSION_COOKIE, scope), sealSession(state.session, scope), { ...secretCookie, maxAge: Math.max(1, Math.floor((state.session.expires - Date.now()) / 1000)) })
        rememberProof(response, state.session)
      }
      return response
    } else if (request.method !== 'GET' && action !== 'settings') return json({ message: 'Unknown security action.' }, 400)
    if (state.session && !['settings-code', 'challenge'].includes(state.stage)) {
      const saved = await preferences(state)
      if (state.stage !== 'identity' && saved.enrolled && (!state.ticket || action === 'reconcile')) state = { ...state, stage: 'ready' }
      return writePending(json({ ...publicState(state), preferences: saved, can_save: !!state.ticket }), scope, state)
    }
    return writePending(json(publicState(state)), scope, state)
  } catch (error) {
    if (error instanceof ProtectionFailure) {
      const response = json({ message: error.message }, error.status)
      if (error.retry) response.headers.set('Retry-After', String(error.retry))
      return response
    }
    return json({ message: 'The security service could not be reached. Retry without assuming the last change was saved.' }, 503)
  }
}