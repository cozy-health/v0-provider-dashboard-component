"use client"

import { useEffect, useState, useCallback } from "react"
import { api, Page } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { refreshingLoadState, visibleLoadState, type ProviderLoadState } from "@/lib/provider-load-state"

export function Loading() { return <div role="status" aria-label="Loading" className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><span className="sr-only">Loading…</span></div> }
export function Empty({ children }: { children: React.ReactNode }) { return <div className="workspace-panel workspace-empty"><div className="max-w-md text-sm leading-relaxed text-muted-foreground">{children}</div></div> }
export function Failure({ error, retry }: { error: string; retry: () => void }) { return <div role="alert" className="rounded-xl border p-6"><p className="mb-3 text-sm text-foreground">{error}</p><Button variant="outline" onClick={retry}>Try again</Button></div> }
export function useData<T>(path: string, { retainOnReload = false }: { retainOnReload?: boolean } = {}) {
  const [state, setState] = useState<ProviderLoadState<T>>({ path, loading: true, refreshing: false })
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => {
    setState(previous => retainOnReload ? refreshingLoadState(previous, path) : { path, loading: true, refreshing: false })
    setRevision(n => n + 1)
  }, [path, retainOnReload])
  const revalidate = useCallback(() => {
    setState(previous => refreshingLoadState(previous, path))
    setRevision(n => n + 1)
  }, [path])
  useEffect(() => {
    const controller = new AbortController()
    api<T>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setState({ path, data, loading: false, refreshing: false }) }).catch(err => { if (!controller.signal.aborted) setState({ path, error: err.message, loading: false, refreshing: false }) })
    return () => controller.abort()
  }, [path, revision])
  // Never expose the previous patient's data during a route/record change.
  return { ...visibleLoadState(state, path), reload, revalidate }
}

export function DataList<T>({ path, empty, render, revision = 0, header, layout = "list" }: { path: string; empty: React.ReactNode; render: (item: T) => React.ReactNode; revision?: number; header?: (items: T[]) => React.ReactNode; layout?: "list" | "grid" }) {
  return <ListPages<T> key={`${path}:${revision}`} path={path} empty={empty} render={render} header={header} layout={layout} />
}
function ListPages<T>({ path, empty, render, header, layout }: { path: string; empty: React.ReactNode; render: (item: T) => React.ReactNode; header?: (items: T[]) => React.ReactNode; layout: "list" | "grid" }) {
  const [page, setPage] = useState(1)
  return <PageData<T> key={page} path={path} page={page} setPage={setPage} empty={empty} render={render} header={header} layout={layout} />
}
function PageData<T>({ path, page, setPage, empty, render, header, layout }: { path: string; page: number; setPage: (page: number) => void; empty: React.ReactNode; render: (item: T) => React.ReactNode; header?: (items: T[]) => React.ReactNode; layout: "list" | "grid" }) {
  const { data, error, loading, reload } = useData<Page<T>>(`${path}${path.includes("?") ? "&" : "?"}page=${page}&per_page=20`)
  if (loading) return <Loading />
  if (error) return <Failure error={error} retry={reload} />
  return <div className="space-y-4">{data && header?.(data.data)}{!data?.data.length ? <Empty>{empty}</Empty> : <div className={layout === "grid" ? "workspace-resource-grid" : "space-y-3"}>{data.data.map((item, i) => <div className="min-w-0" key={i}>{render(item)}</div>)}</div>}
    {data && data.last_page > 1 && <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="order-first w-full text-center text-sm text-muted-foreground sm:order-none sm:w-auto">Page {data.current_page} of {data.last_page} · {data.total} records</span><Button variant="outline" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Next</Button></div>}
  </div>
}

export function date(value?: string | null) { return value ? new Date(value).toLocaleString() : "—" }
export function Card({ children }: { children: React.ReactNode }) { return <div className="workspace-panel h-full min-w-0 p-5 [overflow-wrap:anywhere] sm:p-6">{children}</div> }
