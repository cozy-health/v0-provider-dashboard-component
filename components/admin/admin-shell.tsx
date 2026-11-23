"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { LogOut } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { Button } from "@/components/ui/button"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"
import { AdminThemeSelector } from "./theme-selector"
import { adminModules } from "@/lib/admin-modules"
import "./admin-theme.css"
import { AdminIcon, moduleVisual } from "./admin-visuals"
const groups: { label: string; items: [string, string][] }[] = [
 { label: "Overview", items: [["/admin", "Overview"], ["/admin/datacenter", "Analytics"], ["/admin/safety", "Safety"]] },
 { label: "People & Wellness", items: adminModules.filter(([key]) => ["articles", "users", "moods", "expressions", "triggers", "user-triggers", "coping", "user-coping", "challenges", "quizzes"].includes(key)).map(([key, label]) => [`/admin/manage/${key}`, label]) },
 { label: "Community", items: adminModules.filter(([key]) => ["community-moderation", "communities", "reports", "posts", "comments", "members"].includes(key)).map(([key, label]) => [`/admin/manage/${key}`, label]) },
 { label: "Operations", items: adminModules.filter(([key]) => ["packages", "subscriptions", "student-applications", "subscription-events", "development-access", "emails", "support", "privacy-requests"].includes(key)).map(([key, label]) => [`/admin/manage/${key}`, label]) },
 { label: "Your account", items: [["/admin/settings", "Settings"]] },
]
function capability(href: string) {
 if (href === "/admin/settings") return "personal"
 const moduleKey = href.split("/").pop()
 if (moduleKey === "community-moderation") return "admin:moderation"
 if (moduleKey === "development-access") return "admin:development-access"
 if (moduleKey === "support") return "admin:support"
 if (moduleKey === "privacy-requests") return "admin:privacy"
 if (["users"].includes(moduleKey!)) return "admin:users"
 if (["reports", "support", "posts", "comments", "members"].includes(moduleKey!)) return "admin:moderation"
 if (["packages", "subscriptions", "subscription-events", "student-applications"].includes(moduleKey!)) return "admin:subscriptions"
 if (moduleKey === "emails") return "admin:email"
 return href.includes("/manage/") && !["user-triggers", "user-coping"].includes(moduleKey!) ? "admin:content" : "admin:metrics"
}
export function AdminShell({ expires, children, name = "Admin", capabilities = ["admin:metrics"] }: { expires: number; children: React.ReactNode; name?: string; capabilities?: string[] }) {
 const pathname = usePathname()
 const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false)
 useEffect(() => { const timer = window.setTimeout(() => window.location.replace("/admin/login?expired=1"), Math.max(0, expires - Date.now())); return () => window.clearTimeout(timer) }, [expires])
 async function logout() { setBusy(true); setError(null); try { await adminApi("auth/logout", { method: "POST", body: "{}" }); window.location.replace("/admin/login") } catch (err) { setError((err as Error).message); setBusy(false) } }
 const context = groups.flatMap(group => group.items).find(([href]) => href === pathname)?.[1] ?? "Administration"
 const navigation = <nav aria-label="Admin navigation">{groups.map(group => {
  const visible = group.items.filter(([href]) => capability(href) === "personal" || capabilities.includes(capability(href)))
  if (!visible.length) return null
  return <div key={group.label}><p>{group.label}</p><div className="space-y-1">{visible.map(([href, label]) => {
   const key = href === "/admin" ? "dashboard" : href.split("/").pop()!
   return <Link key={href} href={href} prefetch={false} aria-current={pathname === href ? "page" : undefined} className="admin-nav-link"><AdminIcon small visual={moduleVisual(key)} /><span>{label}</span></Link>
  })}</div></div>
 })}</nav>
 return <div className="cozy-admin"><WorkspaceShell audience="Administration" context={context} name={name} navigation={navigation} appearance={<AdminThemeSelector />} accountAction={<Button variant="ghost" disabled={busy} onClick={logout} aria-label={busy ? "Signing out..." : "Logout"} title="Logout"><LogOut className="size-4" /></Button>}>
  {error && <p role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-card p-4 text-sm text-destructive">{error}</p>}{children}
 </WorkspaceShell></div>
}
