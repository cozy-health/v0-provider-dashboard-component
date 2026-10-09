"use client"

import { useEffect, useState, useCallback } from "react"
import { api, Page } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export function Loading() { return <div role="status" aria-label="Loading" className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><span className="sr-only">Loading…</span></div> }
export function Empty({ children }: { children: React.ReactNode }) { return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</p> }
export function Failure({ error, retry }: { error: string; retry: () => void }) { return <div role="alert" className="rounded-xl border p-6"><p className="mb-3 text-sm text-destructive">{error}</p><Button variant="outline" onClick={retry}>Try again</Button></div> }
export function useData<T>(path: string) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => { setState({ loading: true }); setRevision(n => n + 1) }, [])
  const revalidate = useCallback(() => { setRevision(n => n + 1) }, [])
  useEffect(() => {
    const controller = new AbortController()
    api<T>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setState({ data, loading: false }) }).catch(err => { if (!controller.signal.aborted) setState({ error: err.message, loading: false }) })
    return () => controller.abort()
  }, [path, revision])
  return { ...state, reload, revalidate }
}

export function DataList<T>({ path, empty, render, revision = 0, header }: { path: string; empty: string; render: (item: T) => React.ReactNode; revision?: number; header?: (items: T[]) => React.ReactNode }) {
  return <ListPages<T> key={`${path}:${revision}`} path={path} empty={empty} render={render} header={header} />
}
function ListPages<T>({ path, empty, render, header }: { path: string; empty: string; render: (item: T) => React.ReactNode; header?: (items: T[]) => React.ReactNode }) {
  const [page, setPage] = useState(1)
  return <PageData<T> key={page} path={path} page={page} setPage={setPage} empty={empty} render={render} header={header} />
}
function PageData<T>({ path, page, setPage, empty, render, header }: { path: string; page: number; setPage: (page: number) => void; empty: string; render: (item: T) => React.ReactNode; header?: (items: T[]) => React.ReactNode }) {
  const { data, error, loading, reload } = useData<Page<T>>(`${path}${path.includes("?") ? "&" : "?"}page=${page}&per_page=20`)
  if (loading) return <Loading />
  if (error) return <Failure error={error} retry={reload} />
  return <div className="space-y-4">{data && header?.(data.data)}{!data?.data.length ? <Empty>{empty}</Empty> : <div className="space-y-3">{data.data.map((item, i) => <div key={i}>{render(item)}</div>)}</div>}
    {data && data.last_page > 1 && <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-sm text-muted-foreground">Page {data.current_page} of {data.last_page} · {data.total} records</span><Button variant="outline" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Next</Button></div>}
  </div>
}

export function date(value?: string | null) { return value ? new Date(value).toLocaleString() : "—" }
export function Card({ children }: { children: React.ReactNode }) { return <div className="rounded-xl border bg-card p-4 sm:p-6">{children}</div> }
