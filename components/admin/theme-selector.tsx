"use client"
import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"
const subscribe = () => () => {}
export function AdminThemeSelector() {
 const { theme, setTheme } = useTheme()
 const mounted = useSyncExternalStore(subscribe, () => true, () => false)
 return <label className="flex items-center gap-2 text-sm">{mounted && theme === "dark" ? <Moon aria-hidden="true" className="size-4" /> : mounted && theme === "light" ? <Sun aria-hidden="true" className="size-4" /> : <Monitor aria-hidden="true" className="size-4" />}Appearance<select aria-label="Appearance" className="rounded-lg border bg-card p-2" value={mounted ? theme : "system"} onChange={e => setTheme(e.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
}
