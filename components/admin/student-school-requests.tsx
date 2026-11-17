'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'

type School = { id: string; institution: string; domain: string; website: string; status: string }
type Result = { data: { data: School[]; last_page: number } }

export function StudentSchoolRequests() {
  const [rows, setRows] = useState<School[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const result = await adminApi<Result>(`student-school-requests?page=${page}`, { signal })
      if (signal?.aborted) return
      setRows(result.data.data); setLastPage(result.data.last_page)
    } catch (error) { if (!signal?.aborted) setMessage(error instanceof Error ? error.message : 'Could not load school requests.') }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [page])
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [load])

  async function review(event: React.FormEvent<HTMLFormElement>, row: School) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    setBusy(true); setMessage('')
    try {
      await adminApi(`student-school-requests/${row.id}/review`, { method: 'POST', body: JSON.stringify({ decision: form.get('decision'), note: form.get('note'), institution_type: form.get('institution_type'), nigerian_tertiary_confirmed: form.get('confirmed') === 'on' }) })
      setMessage('Decision saved. Students must still verify their own school mailbox.')
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save the decision. Refresh before retrying.') }
    finally { setBusy(false) }
  }

  return <section aria-labelledby="school-requests-heading" className="min-w-0 space-y-4 break-words border-t pt-6">
    <h2 id="school-requests-heading" className="text-xl font-semibold">Requests to add a school</h2>
    <p>Verify Nigerian tertiary recognition and the actual email domain using official sources. Approval checks the school once; each applicant still proves mailbox ownership. Staff and alumni may qualify.</p>
    <p>Notifications go to team@cozyhealth.org and cozyhealth.hq@gmail.com.</p>
    {message && <p role="status">{message}</p>}
    <Button variant="outline" disabled={busy || loading} onClick={() => void load()}>Refresh school requests</Button>
    {loading ? <p role="status">Loading school requests...</p> : rows.length === 0 ? <p>No school requests.</p> : rows.map(row => <article className="rounded border p-4 space-y-3" key={row.id}>
      <h3 className="font-semibold">{row.institution}</h3>
      <p className="break-all">{row.domain} · {row.status}</p>
      <p className="break-all">Submitted website (unverified): {row.website}</p>
      {row.status === 'pending' && <form className="space-y-3" onSubmit={event => void review(event, row)}>
        <label className="block">Decision<select aria-label="Decision" name="decision" className="block w-full min-w-0 max-w-full border p-2" disabled={busy}><option value="rejected">Reject</option><option value="approved">Approve</option></select></label>
        <label className="block">Institution type<select aria-label="Institution type" name="institution_type" className="block w-full min-w-0 max-w-full border p-2" disabled={busy}><option value="tertiary">Other tertiary</option><option value="university">University</option><option value="polytechnic">Polytechnic</option><option value="college_of_education">College of education</option></select></label>
        <label className="flex gap-2"><input name="confirmed" type="checkbox" disabled={busy} />I confirmed Nigerian tertiary status and ownership of this email domain. Required for approval.</label>
        <label className="block">Decision reason and source references<textarea name="note" required minLength={5} maxLength={2000} className="block w-full border p-2" disabled={busy} /></label>
        <Button type="submit" disabled={busy || loading}>Save school decision</Button>
      </form>}
    </article>)}
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy || loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous requests</Button><span>Page {page} of {lastPage}</span><Button variant="outline" disabled={busy || loading || page >= lastPage} onClick={() => setPage(value => value + 1)}>Next requests</Button></div>
  </section>
}
