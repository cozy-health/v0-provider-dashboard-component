'use client'
import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/admin-api'
import { Button } from '@/components/ui/button'

type AgeCase = { id: string; user_id: number; kind: string; status: string; message: string; resolution: string | null; assignee_id: number | null; eligibility: { reason: string | null; age_band: string } | null }
type Result = { data: { data: AgeCase[]; last_page: number } }
export function AgeCases() {
  const [cases, setCases] = useState<AgeCase[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [dob, setDob] = useState('')
  const [reference, setReference] = useState('')
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    adminApi<Result>(`age-cases?page=${page}`).then(result => { if (active) { setCases(result.data.data); setLastPage(result.data.last_page); setError('') } }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Cases could not be loaded.') })
    return () => { active = false }
  }, [page, revision])
  async function save(action: 'assign' | 'resolve' | 'correct_dob' | 'clear_dispute') {
    if (!selected || busy) return
    setBusy(true)
    try {
      await adminApi(`age-cases/${selected}/resolve`, { method: 'POST', body: JSON.stringify({ action, note, authority_checked: checked, verification_reference: reference, ...(action === 'correct_dob' ? { date_of_birth: dob } : {}) }) })
      setRevision(value => value + 1); setSelected(null); setNote(''); setDob(''); setChecked(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'The case could not be updated.') }
    finally { setBusy(false) }
  }
  return <section className="space-y-6 p-6"><h1 className="text-3xl font-semibold">Age & guardian support</h1>
    <p className="max-w-3xl leading-7 text-muted-foreground">This queue handles corrections, disputed requests, privacy questions and appeals. Normal email authorization is automatic. Email access does not prove guardianship. Do not request identity documents by email, copy health records into notes or promise immediate review. Assign a case before resolving it; arrange cover through the team queue before absence.</p>
    <p className="max-w-3xl">Corrections require an approved, proportionate authority check. If no approved method resolves the case, leave the account restricted. These controls cannot bypass country, policy or health-data activation requirements. Use a different reviewer for appeals where practical.</p>
    {error && <p role="alert" className="rounded-lg border p-4">{error}</p>}
    {cases.length === 0 && <p>No cases are currently available.</p>}
    {cases.map(item => <article key={item.id} className="space-y-4 rounded-xl border p-5"><h2 className="font-semibold">Account {item.user_id} · {item.kind.replaceAll('_', ' ')}</h2><p>{item.status} · Assigned reviewer: {item.assignee_id ?? 'Unassigned'} · {item.eligibility?.reason?.replaceAll('_', ' ') ?? 'No eligibility restriction'}</p><p className="whitespace-pre-wrap">{item.message}</p>{item.resolution && <p>Resolution: {item.resolution}</p>}
      {item.status === 'open' && <Button variant="outline" onClick={() => { setSelected(item.id); setNote(''); setDob(''); setReference(''); setChecked(false) }}>Open case actions</Button>}
      {selected === item.id && <div className="space-y-4"><label className="block">Response to requester / case handover note (omit confidential third-party information)<textarea className="mt-2 block w-full rounded border bg-background p-3" maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></label><label className="block">Corrected date of birth, if applicable<input className="ml-3 rounded border bg-background p-3" type="date" value={dob} onChange={event => setDob(event.target.value)} /></label><label className="block">Approved authority-check reference<input className="mt-2 block w-full rounded border bg-background p-3" value={reference} maxLength={200} onChange={event => setReference(event.target.value)} /></label><label className="flex min-h-12 gap-3"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />I completed the approved authority check and recorded its reference, without copying evidence into these notes.</label><div className="flex flex-wrap gap-3"><Button disabled={busy || note.trim().length < 10} onClick={() => save('assign')}>Assign to me / take over</Button><Button variant="outline" disabled={busy || note.trim().length < 10} onClick={() => save('resolve')}>Close with response recorded</Button><Button variant="outline" disabled={busy || !checked || !dob || note.trim().length < 10} onClick={() => save('correct_dob')}>Correct DOB and require new authorization</Button><Button variant="outline" disabled={busy || !checked || note.trim().length < 10} onClick={() => save('clear_dispute')}>Resolve dispute; require new authorization</Button></div></div>}
    </article>)}
    <div className="flex items-center gap-4"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page} of {lastPage}</span><Button variant="outline" disabled={page >= lastPage} onClick={() => setPage(value => value + 1)}>Next</Button></div>
  </section>
}
