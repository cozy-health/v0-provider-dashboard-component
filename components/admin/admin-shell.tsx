"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { adminApi } from "@/lib/admin-api"
import { Button } from "@/components/ui/button"
const items = [["/admin", "Overview"], ["/admin/usage", "Usage"], ["/admin/retention", "Retention"], ["/admin/safety", "Safety"]]
export function AdminShell({ expires, children }: { expires: number; children: React.ReactNode }) {
  const pathname = usePathname(), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
  useEffect(() => { const timer = window.setTimeout(() => window.location.replace("/admin/login?expired=1"), Math.max(0, expires - Date.now())); return () => window.clearTimeout(timer) }, [expires])
  async function logout() { setBusy(true); setError(null); try { await adminApi("auth/logout", { method: "POST", body: "{}" }); window.location.replace("/admin/login") } catch (err) { setError((err as Error).message); setBusy(false) } }
  return <div className="min-h-screen bg-background"><header className="border-b"><div className="max-w-7xl mx-auto p-5 flex flex-wrap gap-4 justify-between items-center"><div><p className="font-semibold text-lg">Cozy Health</p><p className="text-sm text-muted-foreground">Operations analytics</p></div><Button variant="outline" disabled={busy} onClick={logout}>{busy ? "Signing out…" : "Sign out"}</Button></div><nav aria-label="Admin navigation" className="max-w-7xl mx-auto px-5 pb-4 flex flex-wrap gap-2">{items.map(([href, label]) => <Link key={href} href={href} prefetch={false} aria-current={pathname === href ? "page" : undefined} className={`px-4 py-2 rounded-md text-sm ${pathname === href ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{label}</Link>)}</nav></header><main className="max-w-7xl mx-auto p-5 sm:p-8">{error && <p role="alert" className="text-destructive mb-4">{error}</p>}<p className="text-xs text-muted-foreground mb-6">Aggregate data only · Minimum cohort 5 · No patient drill-down</p>{children}</main></div>
}
