import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cookieScope, scopedCookie } from '@/lib/provider-auth-scope'
import { openSession, SESSION_COOKIE } from '@/lib/provider-session'
import { ProviderAccountBoundary } from '@/components/provider/account-boundary'
import { SignInProtection } from '@/components/provider/sign-in-protection'
export const dynamic = 'force-dynamic'
export default async function SecurityPage() {
  const jar = await cookies(), scope = cookieScope(jar)
  const session = openSession(jar.get(scopedCookie(SESSION_COOKIE, scope))?.value, scope)
  if (!session || !scope) redirect('/login?expired=1')
  return <ProviderAccountBoundary scope={scope}><SignInProtection settings /></ProviderAccountBoundary>
}