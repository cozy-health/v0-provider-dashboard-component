'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/lib/admin-api'
import { StudentSchoolRequests } from './student-school-requests'
import { Button } from '@/components/ui/button'

type Domain = { id: number; domain: string; institution: string; enabled: boolean | number; version: number }
type Result = { data: { data: Domain[]; last_page: number } }

export function StudentDomains() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [domain, setDomain] = useState('')
  const [institution, setInstitution] = useState('')
  const [createEnabled, setCreateEnabled] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const result = await adminApi<Result>(`student-email-domains?page=${page}`, { signal })
      if (signal?.aborted) return
      setDomains(result.data.data); setLastPage(result.data.last_page); setError('')
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Could not load student domains.')
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [page])
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [load])

  async function save(row?: Domain) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await adminApi(row ? `student-email-domains/${row.id}` : 'student-email-domains', {
        method: row ? 'PUT' : 'POST',
        body: JSON.stringify(row ? { enabled: !row.enabled, version: row.version } : { domain: domain.trim(), institution: institution.trim(), nigerian_tertiary_confirmed: confirmed, enabled: createEnabled }),
      })
      if (!row) { setDomain(''); setInstitution(''); setConfirmed(false) }
      setNotice(row ? 'Domain updated. Existing eligibility keeps its recorded expiry.' : createEnabled ? 'Nigerian tertiary domain approved. Verified ownership is still required.' : 'Domain blocked. Existing eligibility keeps its recorded expiry.')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save the domain. Refresh before retrying.') }
    finally { setBusy(false) }
  }

  return <section aria-labelledby="student-domains-heading" className="min-w-0 space-y-4 break-words border-t pt-6">
    <h2 id="student-domains-heading" className="text-xl font-semibold">Approved student email domains</h2>
    <p className="max-w-2xl text-sm text-muted-foreground">Institutional .edu.ng domains qualify automatically unless explicitly blocked. Add verified Nigerian tertiary exceptions here. Staff and alumni with working mailboxes may qualify. Exception domains match exactly. Disabling a domain blocks future verification, including .edu.ng domains.</p>
    <form className="max-w-xl space-y-3" onSubmit={event => { event.preventDefault(); void save() }}>
      <label className="block">Nigerian academic domain<input required maxLength={253} placeholder="students.university.example" className="mt-1 block w-full rounded border p-3" value={domain} onChange={event => setDomain(event.target.value)} disabled={busy} /></label>
      <label className="block">Institution name<input required maxLength={200} className="mt-1 block w-full rounded border p-3" value={institution} onChange={event => setInstitution(event.target.value)} disabled={busy} /></label>
      <label className="block">Domain policy<select className="block w-full min-w-0 max-w-full border p-2" value={createEnabled ? "enabled" : "blocked"} onChange={event => setCreateEnabled(event.target.value === "enabled")} disabled={busy}><option value="enabled">Approve exact domain</option><option value="blocked">Block domain and subdomains</option></select></label>
      <label className="flex items-start gap-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />I confirmed Nigerian tertiary status and ownership of this email domain. Mailbox ownership does not prove current enrollment.</label>
      <Button type="submit" disabled={busy || loading || !confirmed || !domain.trim() || !institution.trim()}>Save domain policy</Button>
    </form>
    {notice && <p role="status">{notice}</p>}
    {error && <div role="alert"><p>{error}</p><Button variant="outline" disabled={busy} onClick={() => void load()}>Refresh student domains</Button></div>}
    {loading ? <p role="status">Loading student domains…</p> : !error && !domains.length ? <p>No exception or blocked domains. Institutional .edu.ng email verification remains available.</p> : null}
    {!loading && domains.map(row => <article className="rounded border p-4" key={row.id}>
      <h3 className="break-all font-semibold">{row.domain}</h3><p>{row.institution} · {row.enabled ? 'Enabled' : 'Disabled'}</p>
      <Button variant="outline" aria-label={`${row.enabled ? 'Disable' : 'Enable'} ${row.domain}`} disabled={busy || !!error} onClick={() => void save(row)}>{row.enabled ? 'Disable domain' : 'Enable domain'}</Button>
    </article>)}
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy || loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous domains</Button><span>Page {page} of {lastPage}</span><Button variant="outline" disabled={busy || loading || page >= lastPage} onClick={() => setPage(value => value + 1)}>Next domains</Button></div>
    <StudentSchoolRequests />
  </section>
}
