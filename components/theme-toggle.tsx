"use client"
import { usePathname } from "next/navigation"
import { ThemeButton } from "@/components/theme-button"
export function ThemeToggle() {
  const path = usePathname()
  if (["/admin/login", "/admin/reset-password"].includes(path)) return <div className="cozy-admin absolute right-4 top-4 z-30"><ThemeButton /></div>
  if (path === "/provider" || path.startsWith("/admin")) return null
  return <div className="absolute right-4 top-4 z-30"><ThemeButton /></div>
}
