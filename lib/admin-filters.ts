"use client"
import { useCallback, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function useAdminFilters(module: string) {
 const params = useSearchParams(), pathname = usePathname(), restored = useRef("")
 const statuses = module === "reports" ? ["pending", "resolved"] : module === "support" ? ["open", "resolved"] : []
 const status = statuses.includes(params.get("status") || "") ? params.get("status")! : ""
 const group = ["posts", "members"].includes(module) && /^[1-9]\d*$/.test(params.get("group_id") || "") ? params.get("group_id")! : ""
 const overdue = module === "reports" && params.get("overdue") === "1"
 const page = /^[1-9]\d*$/.test(params.get("page") || "") ? Number(params.get("page")) : 1
 const size = [10, 20, 50].includes(Number(params.get("per_page"))) ? Number(params.get("per_page")) : 10
 const search = (params.get("search") || "").slice(0, 100)
 const record = /^[1-9]\d*$/.test(params.get("record") || "") ? params.get("record")! : ""
 const key = `cozy-admin-filters:v1:${module}`
 const setFilter = useCallback((updates: Record<string, string | number | null>) => {
  const next = new URLSearchParams(params.toString())
  Object.entries(updates).forEach(([key, value]) => { if (value === null || value === "") next.delete(key); else next.set(key, String(value)) })
  const remembered: Record<string, string> = {}
  if ((module === "reports" ? ["pending", "resolved"] : module === "support" ? ["open", "resolved"] : []).includes(next.get("status") || "")) remembered.status = next.get("status")!
  if (["posts", "members"].includes(module) && /^[1-9]\d*$/.test(next.get("group_id") || "")) remembered.group_id = next.get("group_id")!
  if (module === "reports" && next.get("overdue") === "1") { remembered.status = "pending"; remembered.overdue = "1" }
  try { localStorage.setItem(key, JSON.stringify(remembered)) } catch {}
  window.history.replaceState(null, "", pathname + (next.size ? "?" + next : ""))
 }, [params, pathname, key, module])
 useEffect(() => {
  if (restored.current === module) return
  restored.current = module
  if (["status", "group_id", "overdue"].some(name => params.has(name))) return
  try {
   const saved = JSON.parse(localStorage.getItem(key) || "{}")
   const next: Record<string, string> = {}
   if ((module === "reports" ? ["pending", "resolved"] : module === "support" ? ["open", "resolved"] : []).includes(saved.status)) next.status = saved.status
   if (module === "reports" && saved.overdue === "1") { next.status = "pending"; next.overdue = "1" }
   if (["posts", "members"].includes(module) && /^[1-9]\d*$/.test(saved.group_id)) next.group_id = saved.group_id
   if (Object.keys(next).length) setFilter(next)
  } catch {}
 }, [module, key, params, setFilter])
 return { status: overdue ? "pending" : status, group, overdue, page, size, search, record, setFilter }
}
