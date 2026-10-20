"use client"
import { usePathname } from "next/navigation"
import { Analytics } from "@vercel/analytics/next"
export function PageAnalytics() {
  const path = usePathname()
  return path === "/admin" || path.startsWith("/admin/") ? null : <Analytics />
}
