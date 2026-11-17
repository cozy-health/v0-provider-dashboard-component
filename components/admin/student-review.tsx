'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'
import { StudentDomains } from './student-domains'
type Application = { id: string; institution: string; institution_email: string | null; email_verified_at: string | null; verification_method?: 'document' | 'email'; status: string; eligible_until: string | null; review_note: string | null; evidence_available: boolean; evidence_cleanup_pending: boolean }
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
  const [loading, setLoading] = useState(true)
  const pageRef = useRef(page)
  const requestVersion = useRef(0)
  const mounted = useRef(false)
  pageRef.current = page
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; requestVersion.current += 1 }
  }, [])
  const load = useCallback(async () => {
    const currentPage = pageRef.current
    const version = ++requestVersion.current
    const current = () => mounted.current && version === requestVersion.current && currentPage === pageRef.current
    setLoading(true); setApplications([]); setError(null)
    try {
      const response = await adminApi<{ data: { data: Application[]; last_page: number } }>(`student-applications?page=${currentPage}`)
      if (!current()) return
      const last = Math.max(1, response.data.last_page)
      setLastPage(last)
      if (currentPage > last) { setPage(last); return }
      setApplications(response.data.data)
    } catch (err) { if (current()) setError(err instanceof Error ? err.message : 'Could not load applications.') }
    finally { if (current()) setLoading(false) }
  }, [])
  useEffect(() => {
    setSelected(null); setNote(''); setVerified(false)
    void load()
    return () => { requestVersion.current += 1 }
  }, [page, load])
  async function review(decision: 'approved' | 'rejected') {
    if (!selected || busy) return
    setBusy(true)
    try { const result = await adminApi<{ evidence_deleted: boolean }>(`student-applications/${selected}/review`, { method: 'POST', body: JSON.stringify({ decision, note, current_enrolment_verified: verified }) }); if (!mounted.current) return; setSelected(null); setNote(''); setVerified(false); setNotice(result.evidence_deleted ? 'Decision saved. The evidence document was deleted.' : 'Decision saved. Evidence access is closed; physical deletion needs a retry.'); await load() }
    catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Review could not be saved.') }
    finally { if (mounted.current) setBusy(false) }
  }
  return <section className="min-w-0 space-y-6 break-words p-6 [&_button]:h-auto [&_button]:min-h-11 [&_button]:max-w-full [&_button]:whitespace-normal"><h1 className="text-3xl font-semibold">Student verification</h1><p className="max-w-2xl text-muted-foreground">Review current-term enrolment letters, registration records or student IDs showing current validity. Verified ownership of an approved student-only email domain provides a separate automatic route. Do not copy evidence into review notes or download it onto shared devices. Eligibility lasts 12 months.</p>
    <p className="max-w-2xl text-sm text-muted-foreground">New applicants verify Nigerian academic email; document submissions are disabled at launch. Historical document applications remain locked and evidence is deleted after a decision or 14 days. Eligibility renewal opens 30 days before expiry and never grants a paid subscription.</p>
    {notice && <p role="status">{notice}</p>}
    {error && <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => load()}>Retry applications</Button></div>}
    {loading && <p role="status">Loading student applications…</p>}
    {!loading && !error && !applications.length && <p>No student applications.</p>}
    <div className="space-y-4">{applications.map(application => <article key={application.id} className="rounded-xl border p-5"><h2 className="font-semibold">{application.institution}</h2><p>{application.status} · Institution email {application.email_verified_at ? 'confirmed' : 'not confirmed'}</p><p>{application.institution_email}</p>
      <p>Verification: {application.verification_method === 'email' ? 'Student-only email' : 'Admin document review'}</p>
      {application.eligible_until && <p>Eligibility ends: {new Date(application.eligible_until).toLocaleDateString()}</p>}
      {application.review_note && <p className="whitespace-pre-wrap">Decision reason: {application.review_note}</p>}
      {application.evidence_available ? <a href={`/api/admin/student-applications/${application.id}/evidence`} className="inline-block py-3 underline">Download private enrolment evidence</a> : <p className="mt-3 text-sm text-muted-foreground">{application.evidence_cleanup_pending ? 'Evidence access closed. Physical deletion pending.' : 'No evidence document is available.'}</p>}
      {application.status === 'pending' && application.evidence_available && <Button disabled={busy} variant="outline" onClick={() => { setSelected(application.id); setNote(''); setVerified(false) }}>Review application</Button>}
      {selected === application.id && <div className="mt-4 space-y-4"><label className="block">Decision reason (shown to the student)<textarea className="mt-2 block w-full rounded border p-3" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} /></label><label className="flex gap-3"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} />I checked current enrolment evidence, not just email ownership.</label><div className="flex gap-3"><Button disabled={busy || !verified || note.trim().length < 5} onClick={() => review('approved')}>Approve and delete evidence</Button><Button variant="outline" disabled={busy || note.trim().length < 5} onClick={() => review('rejected')}>Reject and delete evidence</Button></div></div>}
    </article>)}</div>
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage(current => current - 1)}>Previous</Button><span>Page {page} of {lastPage}</span><Button variant="outline" disabled={loading || page >= lastPage} onClick={() => setPage(current => current + 1)}>Next</Button></div>
    <StudentDomains />
  </section>
}
