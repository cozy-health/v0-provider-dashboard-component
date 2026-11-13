"use client"

import { useCallback, useEffect, useState } from "react"
import { adminApi, AdminApiError } from "@/lib/admin-api"
import { Button } from "@/components/ui/button"

type Decision = { id: string; user_id: number; kind: string; reason: string; status: string; expires_at: string | null; version: string }
type Appeal = { id: string; decision_id: string; user_id: number; message: string; status: string; version: string; decision?: { kind: string; target_id: string | null; reason: string; status: string } }
type Page<T> = { data: T[]; current_page: number; last_page: number }
type Queue = { data: Page<Decision>; appeals: Page<Appeal> }

export function CommunityModerationWorkspace() {
  const [queue, setQueue] = useState<Queue | null>(null)
  const [page, setPage] = useState(1), [appealsPage, setAppealsPage] = useState(1)
  const [error, setError] = useState(""), [busy, setBusy] = useState(false)
  const [user, setUser] = useState(""), [duration, setDuration] = useState("7d"), [reason, setReason] = useState("")
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({})
  const load = useCallback(async () => { setQueue(await adminApi<Queue>(`community-moderation?page=${page}&appeals_page=${appealsPage}`)) }, [page, appealsPage])
  useEffect(() => { let current = true; setQueue(null); adminApi<Queue>(`community-moderation?page=${page}&appeals_page=${appealsPage}`).then(data => { if (current) setQueue(data) }).catch(failure => { if (current) setError(failure.message) }); return () => { current = false } }, [page, appealsPage])
  async function act(path: string, data: object) {
    setBusy(true); setError("")
    try { await adminApi(path, { method: "POST", body: JSON.stringify(data) }); await load() }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Action failed. Reload before retrying."); if (failure instanceof AdminApiError && [401, 403].includes(failure.status)) setQueue(null); else await load().catch(() => {}) }
    finally { setBusy(false) }
  }
  const field = "block min-h-11 w-full rounded-lg border bg-background p-3"
  return <section className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <h1 className="text-2xl font-semibold">Community restrictions and appeals</h1>
    <p>Restrictions affect community participation only. Reading, reporting, blocking and appeals remain available. Decisions send an in-app notice and queued email.</p>
    {error && <p role="alert" className="whitespace-pre-wrap">{error}</p>}
    <Button disabled={busy} variant="outline" onClick={() => { setError(""); void load().catch(failure => { setError(failure.message); if (failure instanceof AdminApiError && [401, 403].includes(failure.status)) setQueue(null) }) }}>Refresh moderation</Button>
    <form className="space-y-3 rounded-xl border p-4" onSubmit={event => { event.preventDefault(); if (window.confirm("Restrict this user's community participation?")) void act("community-moderation/bans", { user_id: Number(user), duration, reason }) }}>
      <h2 className="text-lg font-semibold">Restrict participation</h2>
      <label className="block">User ID<input className={field} type="number" min={1} required value={user} onChange={event => setUser(event.target.value)} /></label>
      <label className="block">Duration<select className={field} value={duration} onChange={event => setDuration(event.target.value)}><option value="24h">24 hours</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="permanent">Until lifted</option></select></label>
      <label className="block">Reason shown to user<textarea className={field} minLength={5} maxLength={1000} required value={reason} onChange={event => setReason(event.target.value)} /></label>
      <Button disabled={busy || !queue || reason.trim().length < 5}>Apply restriction</Button>
    </form>
    <h2 className="text-lg font-semibold">Decisions</h2>
    {!queue ? <p role="status">Loading moderation...</p> : <>
      {queue.data.data.length === 0 && <p>No decisions yet.</p>}
      {queue.data.data.map(row => <article key={row.id} className="space-y-3 rounded-xl border p-4"><h3>User {row.user_id}: {row.kind} · {row.status}</h3><p>{row.reason}</p><p>{row.expires_at ? `Expires ${new Date(row.expires_at).toLocaleString()}` : "No automatic expiry"}</p>
        {row.kind === "ban" && row.status === "active" && <form onSubmit={event => { event.preventDefault(); if (window.confirm("Lift this restriction?")) void act(`community-moderation/bans/${row.id}/lift`, { expected_version: row.version, reason: reasons[row.id] ?? "" }) }}><label className="block">Reason for lifting<textarea className={field} required minLength={5} maxLength={1000} value={reasons[row.id] ?? ""} onChange={event => setReasons(old => ({ ...old, [row.id]: event.target.value }))} /></label><Button className="mt-3" disabled={busy}>Lift restriction</Button></form>}
      </article>)}
      <div className="flex flex-wrap gap-3"><Button disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>Previous decisions</Button><span>Page {queue.data.current_page}</span><Button disabled={busy || page >= queue.data.last_page} onClick={() => setPage(page + 1)}>Next decisions</Button></div>
      <h2 className="text-lg font-semibold">Pending appeals</h2>
      {queue.appeals.data.length === 0 && <p>No pending appeals.</p>}
      {queue.appeals.data.map(row => <article key={row.id} className="space-y-3 rounded-xl border p-4"><h3>Appeal from user {row.user_id}</h3><p>Decision {row.decision_id}: {row.decision?.kind} ? {row.decision?.status}</p><p>{row.decision?.reason}</p>{row.decision?.target_id && <a className="underline" href={"/admin/manage/" + (row.decision.kind === "post" ? "posts" : "comments") + "?record=" + row.decision.target_id} target="_blank" rel="noopener noreferrer">Review current content</a>}<p className="whitespace-pre-wrap">{row.message}</p><label className="block" htmlFor={`appeal-reason-${row.id}`}>Decision reason</label><textarea id={`appeal-reason-${row.id}`} className={field} minLength={5} maxLength={1000} value={reasons[row.id] ?? ""} onChange={event => setReasons(old => ({ ...old, [row.id]: event.target.value }))} /><label className="flex items-start gap-3"><input className="mt-1 size-5" type="checkbox" checked={confirmations[row.id] ?? false} onChange={event => setConfirmations(old => ({ ...old, [row.id]: event.target.checked }))} />I confirm republishing unchanged content if this is a content appeal.</label><div className="flex flex-wrap gap-3">{(["accepted", "rejected"] as const).map(decision => <Button key={decision} disabled={busy || (reasons[row.id] ?? "").trim().length < 5} onClick={() => { if (window.confirm(`${decision === "accepted" ? "Accept" : "Reject"} this appeal?`)) void act(`community-moderation/appeals/${row.id}/review`, { expected_version: row.version, decision, reason: reasons[row.id], confirm_republish: confirmations[row.id] ?? false }) }}>{decision === "accepted" ? "Accept appeal" : "Reject appeal"}</Button>)}</div></article>)}
      <div className="flex flex-wrap gap-3"><Button disabled={busy || appealsPage <= 1} onClick={() => setAppealsPage(appealsPage - 1)}>Previous appeals</Button><span>Page {queue.appeals.current_page}</span><Button disabled={busy || appealsPage >= queue.appeals.last_page} onClick={() => setAppealsPage(appealsPage + 1)}>Next appeals</Button></div>
    </>}
  </section>
}
