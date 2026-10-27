'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Clock3, FlaskConical, ShieldCheck } from 'lucide-react'
import { adminApi } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Plan = 'student' | 'standard' | 'premium'
type Grant = { id: string; email: string; plan: Plan; expires_at: string; revoked_at: string | null; status: 'active' | 'expired' | 'revoked' }
type Result = { development_only: boolean; data: { data: Grant[]; last_page: number } }
type Pending = { kind: 'grant'; email: string; plan: Plan; duration_days: number; reason: string } | { kind: 'revoke'; grant: Grant }

export function DevelopmentAccess() {
 const [page, setPage] = useState(1), [revision, setRevision] = useState(0)
 const key = `${page}:${revision}`
 const [state, setState] = useState<{ key: string; data?: Result; error?: string }>()
 const current = state?.key === key ? state : undefined
 const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [pending, setPending] = useState<Pending | null>(null)
 const [email, setEmail] = useState(''), [plan, setPlan] = useState<Plan>('premium'), [days, setDays] = useState(7), [reason, setReason] = useState('')
 useEffect(() => {
  const controller = new AbortController()
  adminApi<Result>(`development-access?page=${page}`, { signal: controller.signal }).then(data => {
   if (controller.signal.aborted) return
   if (data.development_only !== true) throw new Error('Development access is unavailable in this environment.')
   if (page > Math.max(1, data.data.last_page)) { setPage(Math.max(1, data.data.last_page)); return }
   setState({ key, data })
  }).catch(error => { if (!controller.signal.aborted) setState({ key, error: error instanceof Error ? error.message : 'Could not load test access.' }) })
  return () => controller.abort()
 }, [key, page])
 function prepare(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  if (busy || !current?.data) return
  setNotice(''); setPending({ kind: 'grant', email: email.trim().toLowerCase(), plan, duration_days: days, reason: reason.trim() })
 }
 async function confirm() {
  if (!pending || busy) return
  setBusy(true); setNotice('')
  try {
   if (pending.kind === 'grant') {
    await adminApi('development-access', { method: 'POST', body: JSON.stringify({ email: pending.email, plan: pending.plan, duration_days: pending.duration_days, reason: pending.reason }) })
    setEmail(''); setReason(''); setNotice('Development test access granted. No payment was collected.')
   } else {
    await adminApi(`development-access/${pending.grant.id}`, { method: 'DELETE', body: '{}' })
    setNotice('Development test access revoked. Any genuine subscription is unchanged.')
   }
   setPending(null); setRevision(value => value + 1)
  } catch (error) { setNotice(error instanceof Error ? error.message : 'Test access could not be saved. Retry when available.') }
  finally { setBusy(false) }
 }
 const rows = current?.data?.data.data
 return <section className="space-y-6">
  <div className="rounded-2xl border bg-card p-6"><p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--cozy-blue)] px-3 py-1 text-xs font-semibold text-white"><FlaskConical className="size-4" aria-hidden="true" />Development only</p><h1 className="text-2xl font-semibold sm:text-3xl">Development test access</h1><p className="mt-3 max-w-2xl text-sm text-muted-foreground">Give an existing development account temporary access to a plan. This does not collect payment, verify student status or change a real subscription.</p><div className="mt-5 flex flex-wrap gap-4 text-sm"><span className="inline-flex items-center gap-2"><Clock3 className="size-4" aria-hidden="true" />1–30 days, then automatic expiry</span><span className="inline-flex items-center gap-2"><ShieldCheck className="size-4" aria-hidden="true" />Every grant and revocation is audited</span></div></div>
  {notice && <p role="status" className="rounded-xl border bg-card p-4">{notice}</p>}
  {current?.error ? <div role="alert" className="rounded-xl border p-5"><p>{current.error}</p><p className="mt-2 text-sm text-muted-foreground">This control requires development configuration and subscription-management permission.</p><Button variant="outline" className="mt-3" onClick={() => setRevision(value => value + 1)}>Retry test access</Button></div> : !rows ? <p role="status">Loading development test access...</p> : <>
   <form onSubmit={prepare} className="grid gap-4 rounded-2xl border bg-card p-6 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">Grant temporary access</h2>
    <label className="text-sm">Development account email<input name="email" required type="email" maxLength={190} disabled={busy} value={email} onChange={event => setEmail(event.target.value)} className="mt-2 block w-full rounded-lg border bg-background p-3" /></label>
    <label className="text-sm">Test plan<select disabled={busy} value={plan} onChange={event => { const value = event.target.value; if (value === 'student' || value === 'standard' || value === 'premium') setPlan(value) }} className="mt-2 block w-full rounded-lg border bg-background p-3"><option value="student">Student</option><option value="standard">Standard</option><option value="premium">Premium</option></select></label>
    <label className="text-sm">Access duration in days<input required type="number" min={1} max={30} step={1} disabled={busy} value={days} onChange={event => setDays(Number(event.target.value))} className="mt-2 block w-full rounded-lg border bg-background p-3" /></label>
    <label className="text-sm">Testing reason<input required minLength={5} maxLength={500} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 block w-full rounded-lg border bg-background p-3" /><span className="mt-2 block text-xs text-muted-foreground">Describe the test. Do not enter private health information.</span></label>
    <div className="sm:col-span-2"><Button disabled={busy}>Review test access</Button></div>
   </form>
   <div className="rounded-2xl border bg-card p-6"><h2 className="mb-4 font-semibold">Grant history</h2>{!rows.length ? <p className="text-sm text-muted-foreground">No test access has been granted.</p> : <ul className="space-y-3">{rows.map(grant => {
    const status = grant.status === 'active' ? 'Active' : grant.status === 'revoked' ? 'Revoked' : 'Expired'
    return <li key={grant.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"><div className="min-w-0"><p className="break-words font-medium">{grant.email}</p><p className="text-sm text-muted-foreground">{grant.plan} · {status} · Ends {new Date(grant.expires_at).toLocaleString()}</p></div>{status === 'Active' && <Button variant="outline" disabled={busy} onClick={() => { setNotice(''); setPending({ kind: 'revoke', grant }) }}>Revoke test access</Button>}</li>
   })}</ul>}<div className="mt-5 flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page} of {current.data?.data.last_page ?? 1}</span><Button variant="outline" disabled={busy || page >= (current.data?.data.last_page ?? 1)} onClick={() => setPage(value => value + 1)}>Next</Button><Button variant="outline" disabled={busy} onClick={() => setRevision(value => value + 1)}>Refresh history</Button></div></div>
  </>}
  <Dialog open={pending !== null} onOpenChange={open => { if (!open && !busy) setPending(null) }}><DialogContent><DialogHeader><DialogTitle>{pending?.kind === 'grant' ? 'Confirm development test access' : 'Revoke development test access?'}</DialogTitle><DialogDescription>{pending?.kind === 'grant' ? 'This is a temporary development grant. No payment will be collected.' : 'The test grant will stop applying to subsequent server requests. Any genuine subscription remains unchanged.'}</DialogDescription></DialogHeader>{pending?.kind === 'grant' ? <p className="break-words">{pending.email} · {pending.plan} · {pending.duration_days} days</p> : <p className="break-words">{pending?.grant.email}</p>}{notice && <p role="alert">{notice}</p>}<div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={confirm}>{busy ? 'Saving...' : pending?.kind === 'grant' ? 'Grant test access' : 'Confirm revocation'}</Button><Button variant="outline" disabled={busy} onClick={() => setPending(null)}>Cancel</Button></div></DialogContent></Dialog>
 </section>
}
