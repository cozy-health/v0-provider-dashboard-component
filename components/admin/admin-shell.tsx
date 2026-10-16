"use client"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useState, useRef } from "react"
import { Menu, LogOut, Heart } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"
import { useDesktopNavigation } from "@/hooks/use-desktop-navigation"
import { AdminThemeSelector } from "./theme-selector"
import { adminModules } from "@/lib/admin-modules"
import "./admin-theme.css"
import { AdminIcon, moduleVisuals } from "./admin-visuals"
const groups = [
 { label: "Overview", items: [["/admin", "Overview"], ["/admin/datacenter", "Analytics"], ["/admin/safety", "Safety"]] },
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
 const closeNavigation = useCallback(() => setOpen(false), [])
 useDesktopNavigation(closeNavigation)
 async function logout() { setBusy(true); setError(null); try { await adminApi("auth/logout", { method: "POST", body: "{}" }); window.location.replace("/admin/login") } catch (err) { setError((err as Error).message); setBusy(false) } }
 const navigation = <><nav aria-label="Admin navigation" className="space-y-6">{groups.map(group => {
 const visible = group.items.filter(([href]) => capabilities.includes(capability(href)))
 if (!visible.length) return null
 return <div key={group.label}><p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</p><div className="space-y-1">{visible.map(([href, label]) => {
 const key = href === "/admin" ? "dashboard" : href.split("/").pop()!
 return <Link key={href} href={href} prefetch={false} onClick={() => setOpen(false)} aria-current={pathname === href ? "page" : undefined} className={`admin-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${pathname === href ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}><AdminIcon small visual={moduleVisuals[key]} /><span>{label}</span></Link>
 })}</div></div>
 })}</nav><p className="mt-6 rounded-2xl border p-4 text-xs leading-relaxed text-muted-foreground"><Heart aria-hidden="true" className="mb-2 size-4 text-[var(--cozy-green)]" />Built around care. Aggregate reporting · Minimum cohort 5 · No patient drill-down</p></>
 const signOut = <Button className="min-h-11" variant="outline" disabled={busy} onClick={logout}><LogOut className="size-4" />{busy ? "Signing out..." : "Logout"}</Button>
 return <div className="cozy-admin min-h-screen">
  <Sheet open={open} onOpenChange={setOpen}>
   <header ref={headerRef} className="sticky top-0 z-30 border-b bg-card"><div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6">
    <div className="flex min-w-0 items-center gap-2 sm:gap-3"><SheetTrigger asChild><Button variant="outline" size="icon" className="size-11 shrink-0 lg:hidden" aria-label="Open navigation"><Menu /></Button></SheetTrigger><Image src="/images/cozy-logo.png" alt="Cozy Health" width={40} height={40} className="shrink-0 rounded-lg" /><div className="min-w-0"><p className="text-base font-semibold sm:text-lg">Cozy Health HQ</p><p className="hidden break-words text-xs text-muted-foreground sm:block">Hi, {name}</p></div></div>
    <div className="flex shrink-0 items-center gap-3"><AdminThemeSelector /><div className="hidden lg:block">{signOut}</div></div>
   </div></header>
   <SheetContent side="left" className="cozy-admin flex h-dvh w-[min(20rem,calc(100%-2rem))] flex-col gap-0 bg-card">
    <SheetHeader className="border-b pr-16"><SheetTitle>Cozy Health HQ</SheetTitle><SheetDescription className="break-words">Hi, {name}</SheetDescription></SheetHeader>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">{navigation}</div>
    <div className="border-t p-4">{error && <p role="alert" className="mb-3 break-words text-sm text-destructive">{error}</p>}{signOut}</div>
   </SheetContent>
  </Sheet>
  <div className="flex"><aside style={{ top: headerHeight, height: `calc(100dvh - ${headerHeight}px)` }} className="sticky hidden w-60 shrink-0 overflow-y-auto border-r bg-card p-4 lg:block">{navigation}</aside><main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 xl:p-10">{error && <p role="alert" className="mb-4 text-destructive">{error}</p>}{children}</main></div>
 </div>
}
