import { cookieScope, scopedCookie } from "@/lib/provider-auth-scope"
import { ProviderAccountBoundary } from "@/components/provider/account-boundary"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { openSession, SESSION_COOKIE } from "@/lib/provider-session"
import { ProviderDashboard } from "@/components/provider/dashboard"

export const dynamic = "force-dynamic"
export default async function Page() {
  const jar = await cookies()
  const scope = cookieScope(jar)
  const session = openSession(jar.get(scopedCookie(SESSION_COOKIE, scope))?.value, scope)
  if (!session) redirect("/login")
  return <ProviderAccountBoundary scope={scope}><ProviderDashboard expires={session.expires} /></ProviderAccountBoundary>
}
