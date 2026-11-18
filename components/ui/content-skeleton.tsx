import { Skeleton } from './skeleton'

export function ContentSkeleton({ label = 'Loading records', rows = 3 }: { label?: string; rows?: number }) {
  return <div role="status" aria-label={label} className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
    <div className="space-y-2"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-3 w-3/5" /></div>
    {Array.from({ length: rows }, (_, index) => <div key={index} aria-hidden="true" className="flex items-center gap-4 border-t pt-4">
      <Skeleton className="size-10 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
    </div>)}
    <span className="sr-only">{label}</span>
  </div>
}
