"use client"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"
import { AdminThemeSelector } from "@/components/admin/theme-selector"
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const path = usePathname()
  if (["/admin/login", "/admin/reset-password"].includes(path)) return <div className="cozy-admin fixed right-4 top-4 z-50 rounded-lg border bg-card p-2"><AdminThemeSelector /></div>
  if (path.startsWith("/admin")) return null
  return <Button variant="outline" size="sm" className="fixed bottom-4 right-4 z-50" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>Toggle theme</Button>
}
