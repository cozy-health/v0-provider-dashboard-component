"use client"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Menu, X, LogOut, Heart } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { Button } from "@/components/ui/button"
import { AdminThemeSelector } from "./theme-selector"
import { adminModules } from "@/lib/admin-modules"
import "./admin-theme.css"
import { AdminIcon, moduleVisuals } from "./admin-visuals"
const groups = [
 { label: "Overview", items: [["/admin", "Dashboard"], ["/admin/datacenter", "Datacenter"], ["/admin/overview", "Overview"], ["/admin/usage", "Usage"], ["/admin/retention", "Retention"], ["/admin/safety", "Safety"]] },
 { label: "People & Wellness", items: adminModules.filter(([key]) => ["users", "moods", "expressions", "triggers", "user-triggers", "coping", "user-coping", "challenges", "quizzes"].includes(key)).map(([key, label]) => [`/admin/manage/${key}`, label]) },
 { label: "Community", items: adminModules.filter(([key]) => ["communities", "reports", "posts", "comments", "members"].includes(key)).map(([key, label]) => [`/admin/manage/${key}`, label]) },
 { label: "Operations", items: adminModules.filter(([key]) => ["packages", "subscriptions", "subscription-events", "emails", "support"].includes(key)).map(([key, label]) => [`/admin/manage/${key}`, label]) },
]
function capability(href: string) {
 const moduleKey = href.split("/").pop()
 if (["users"].includes(moduleKey!)) return "admin:users"
 if (["reports", "support", "posts", "comments", "members"].includes(moduleKey!)) return "admin:moderation"
 if (["packages", "subscriptions", "subscription-events"].includes(moduleKey!)) return "admin:subscriptions"
 if (moduleKey === "emails") return "admin:email"
 return href.includes("/manage/") && !["user-triggers", "user-coping"].includes(moduleKey!) ? "admin:content" : "admin:metrics"
}
export function AdminShell({ expires, children, name = "Admin", capabilities = ["admin:metrics"] }: { expires: number; children: React.ReactNode; name?: string; capabilities?: string[] }) {
 const headerRef = useRef<HTMLElement>(null)
 const [headerHeight, setHeaderHeight] = useState(96)
 useEffect(() => { const header = headerRef.current; if (!header) return; const observer = new ResizeObserver(() => setHeaderHeight(header.getBoundingClientRect().height)); observer.observe(header); return () => observer.disconnect() }, [])
 const pathname = usePathname()
 const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [open, setOpen] = useState(false)
 useEffect(() => { const timer = window.setTimeout(() => window.location.replace("/admin/login?expired=1"), Math.max(0, expires - Date.now())); return () => window.clearTimeout(timer) }, [expires])
 useEffect(() => { if (!open) return; const listener = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }; window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener) }, [open])
 async function logout() { setBusy(true); setError(null); try { await adminApi("auth/logout", { method: "POST", body: "{}" }); window.location.replace("/admin/login") } catch (err) { setError((err as Error).message); setBusy(false) } }
 return <div className="cozy-admin min-h-screen"><header ref={headerRef} className="sticky top-0 z-30 border-b bg-card"><div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><Button variant="outline" size="icon" className="size-11 shrink-0 lg:hidden" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="admin-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button><Image src="/images/cozy-logo.png" alt="Cozy Health" width={42} height={42} className="rounded-lg" /><div className="min-w-0"><p className="text-lg font-semibold">Cozy Health HQ</p><p className="break-all text-xs text-muted-foreground">Hi, {name}</p></div></div><div className="flex items-center gap-3"><AdminThemeSelector /><Button variant="outline" disabled={busy} onClick={logout}><LogOut className="mr-2 size-4" />{busy ? "Signing out…" : "Logout"}</Button></div></div></header><div className="flex">{open && <button style={{ top: headerHeight }} className="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-label="Close navigation" onClick={() => setOpen(false)} />}<aside style={{ top: headerHeight, height: `calc(100dvh - ${headerHeight}px)` }} id="admin-navigation" className={`${open ? "block" : "hidden"} fixed bottom-0 z-40 w-60 overflow-y-auto border-r bg-card p-4 lg:sticky lg:block lg:shrink-0`}><nav aria-label="Admin navigation" className="space-y-6">{groups.map(group => {
 const visible = group.items.filter(([href]) => capabilities.includes(capability(href)))
 if (!visible.length) return null
 return <div key={group.label}><p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</p><div className="space-y-1">{visible.map(([href, label]) => {
 const key = href === "/admin" ? "dashboard" : href.split("/").pop()!
 return <Link key={href} href={href} prefetch={false} onClick={() => setOpen(false)} aria-current={pathname === href ? "page" : undefined} className={`admin-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${pathname === href ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}><AdminIcon small visual={moduleVisuals[key]} /><span>{label}</span></Link>
 })}</div></div>
 })}</nav><p className="mt-6 rounded-2xl border p-4 text-xs leading-relaxed text-muted-foreground"><Heart aria-hidden="true" className="mb-2 size-4 text-[var(--cozy-green)]" />Built around care. Aggregate reporting · Minimum cohort 5 · No patient drill-down</p></aside><main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 xl:p-10">{error && <p role="alert" className="mb-4 text-destructive">{error}</p>}{children}</main></div></div>
}
