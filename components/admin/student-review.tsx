'use client'
import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
type Application = { id: string; institution: string; institution_email: string | null; email_verified_at: string | null; status: string; eligible_until: string | null; review_note: string | null; evidence_available: boolean; evidence_cleanup_pending: boolean }
export function StudentReview() {
  const [applications, setApplications] = useState<Application[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [verified, setVerified] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [notice, setNotice] = useState('')
  async function load(currentPage = page) {
    try { const response = await adminApi<{ data: { data: Application[]; last_page: number } }>(`student-applications?page=${currentPage}`); setApplications(response.data.data); setLastPage(response.data.last_page); setError(null) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load applications.') }
  }
  useEffect(() => {
    let alive = true
    adminApi<{ data: { data: Application[]; last_page: number } }>(`student-applications?page=${page}`).then(response => {
      if (alive) { setApplications(response.data.data); setLastPage(response.data.last_page); setError(null) }
    }).catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Could not load applications.') })
    return () => { alive = false }
  }, [page])
  async function review(decision: 'approved' | 'rejected') {
    if (!selected || busy) return
    setBusy(true)
    try { const result = await adminApi<{ evidence_deleted: boolean }>(`student-applications/${selected}/review`, { method: 'POST', body: JSON.stringify({ decision, note, current_enrolment_verified: verified }) }); setSelected(null); setNote(''); setVerified(false); setNotice(result.evidence_deleted ? 'Decision saved. The evidence document was deleted.' : 'Decision saved. Evidence access is closed; physical deletion needs a retry.'); await load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Review could not be saved.') }
    finally { setBusy(false) }
  }
  return <section className="space-y-6 p-6"><h1 className="text-3xl font-semibold">Student verification</h1><p className="max-w-2xl text-muted-foreground">Verify current, dated enrolment. An institution email alone is insufficient. Do not copy evidence into review notes or download it onto shared devices. Approval normally lasts 12 months.</p>
    <p className="max-w-2xl text-sm text-muted-foreground">Submitted applications are locked. Evidence is deleted after approval or rejection, or after 14 days without a decision. Students can submit fresh evidence after rejection or expiry.</p>
    {notice && <p role="status">{notice}</p>}
    {error && <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => load()}>Retry applications</Button></div>}
    <div className="space-y-4">{applications.map(application => <article key={application.id} className="rounded-xl border p-5"><h2 className="font-semibold">{application.institution}</h2><p>{application.status} · Institution email {application.email_verified_at ? 'confirmed' : 'not confirmed'}</p><p>{application.institution_email}</p>
      {application.eligible_until && <p>Eligibility ends: {new Date(application.eligible_until).toLocaleDateString()}</p>}
      {application.review_note && <p className="whitespace-pre-wrap">Decision reason: {application.review_note}</p>}
      {application.evidence_available ? <a href={`/api/admin/student-applications/${application.id}/evidence`} className="inline-block py-3 underline">Download private enrolment evidence</a> : <p className="mt-3 text-sm text-muted-foreground">{application.evidence_cleanup_pending ? 'Evidence access closed. Physical deletion pending.' : 'No evidence document is available.'}</p>}
      {application.status === 'pending' && application.evidence_available && <Button disabled={busy} variant="outline" onClick={() => { setSelected(application.id); setNote(''); setVerified(false) }}>Review application</Button>}
      {selected === application.id && <div className="mt-4 space-y-4"><label className="block">Decision reason (shown to the student)<textarea className="mt-2 block w-full rounded border p-3" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} /></label><label className="flex gap-3"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} />I checked current enrolment evidence, not just email ownership.</label><div className="flex gap-3"><Button disabled={busy || !verified || note.trim().length < 5} onClick={() => review('approved')}>Approve and delete evidence</Button><Button variant="outline" disabled={busy || note.trim().length < 5} onClick={() => review('rejected')}>Reject and delete evidence</Button></div></div>}
    </article>)}</div>
    <div className="flex gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</Button><span>Page {page} of {lastPage}</span><Button variant="outline" disabled={page >= lastPage} onClick={() => setPage(current => current + 1)}>Next</Button></div>
  </section>
}
