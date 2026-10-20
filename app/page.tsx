import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { openSession, SESSION_COOKIE } from "@/lib/provider-session"
import { ProviderDashboard } from "@/components/provider/dashboard"

export const dynamic = "force-dynamic"
export default async function Page() {
  const session = openSession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect("/login")
  return <ProviderDashboard expires={session.expires} />
}
