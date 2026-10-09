import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ADMIN_COOKIE, adminBase, openAdmin } from "@/lib/admin-session"
import { AdminShell } from "@/components/admin/admin-shell"
export const dynamic = "force-dynamic"
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = openAdmin((await cookies()).get(ADMIN_COOKIE)?.value)
  if (!session) redirect("/admin/login")
  let status = 503
  try { status = (await fetch(new URL("auth/session", adminBase()), { headers: { Authorization: `Bearer ${session.token}`, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) })).status } catch {}
  if ([401, 403].includes(status)) redirect("/admin/login?expired=1")
  if (status !== 200) return <main className="max-w-xl mx-auto p-8"><h1 className="text-xl font-semibold">Admin access could not be checked</h1><p className="mt-3">The service is temporarily unavailable.</p><a className="underline block mt-4" href="/admin">Retry</a></main>
  return <AdminShell expires={session.expires}>{children}</AdminShell>
}
