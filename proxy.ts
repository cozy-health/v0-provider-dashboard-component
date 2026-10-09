import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { contentSecurityPolicy } from './lib/security-headers.mjs'

export function proxy(request: NextRequest) {
  const nonce = randomBytes(16).toString('base64')
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV !== 'production')
  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
