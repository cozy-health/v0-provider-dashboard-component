"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { adminApi } from "@/lib/admin-api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Page<T> = { data: T[]; last_page: number }
type Ticket = { id: number; subject: string; status: "open" | "resolved"; created_at: string }
type Reply = { id: string; author: "customer" | "support"; body: string; created_at: string; notification_status?: string }
type Thread = Ticket & { message: string; version: number; record_version: string; messages: Reply[]; admin_notes: string | null }
type Privacy = { id: string; user_id: number; kind: "export" | "correction" | "deletion"; status: string; version: number; changes?: Record<string, unknown>; outcome: string | null; created_at: string }
type Decision = "approve" | "hold" | "decline"
const field = "block w-full min-w-0 rounded-lg border bg-background p-3 text-sm"
const message = (error: unknown) => error instanceof Error ? error.message : "The request could not be completed."

function useCollection<T>(path: string) {
  const [revision, setRevision] = useState(0)
  const key = `${path}:${revision}`
  const [state, setState] = useState<{ key: string; data?: Page<T>; error?: string }>()
  useEffect(() => {
    const controller = new AbortController()
    adminApi<{ data: Page<T> }>(path, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setState({ key, data: result.data })
    }).catch(error => { if (!controller.signal.aborted) setState({ key, error: message(error) }) })
    return () => controller.abort()
  }, [key, path])
  return { state: state?.key === key ? state : undefined, refresh: () => setRevision(value => value + 1) }
}

export function SupportWorkspace() {
  const record = useSearchParams().get("record")
  const [selected, setSelected] = useState<number | null>(record && /^[1-9]\d*$/.test(record) ? Number(record) : null)
  const [page, setPage] = useState(1), [status, setStatus] = useState("")
  const list = useCollection<Ticket>(`support?page=${page}${status ? `&status=${status}` : ""}`)
  const [thread, setThread] = useState<Thread | null>(null), [revision, setRevision] = useState(0)
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false)
  const [reply, setReply] = useState(""), [note, setNote] = useState("")
  const noteOwner = useRef<number | null>(null)
  const pendingReply = useRef<{ body: string; id: string } | null>(null)
  useEffect(() => {
    if (selected === null) return
    const controller = new AbortController()
    setThread(null); setError("")
    adminApi<{ data: Thread }>(`support/${selected}/thread`, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return
      setThread(data)
      if (noteOwner.current !== selected) { setNote(data.admin_notes ?? ""); noteOwner.current = selected }
    }).catch(error => { if (!controller.signal.aborted) setError(message(error)) })
    return () => controller.abort()
  }, [selected, revision])
  function choose(id: number) { if (busy) return; setSelected(id); setReply(""); pendingReply.current = null; setNotice("") }
  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return
    setBusy(true); setError(""); setNotice("")
    try { await action(); setNotice(success); setRevision(value => value + 1); list.refresh() }
    catch (error) { setError(`${message(error)} Your unsent text is still here. Refresh the conversation before retrying.`) }
    finally { setBusy(false) }
  }
  function send() {
    if (!thread || !reply.trim()) return
    if (pendingReply.current?.body !== reply.trim()) pendingReply.current = { body: reply.trim(), id: crypto.randomUUID() }
    const payload = pendingReply.current
    if (!payload) return
    void run(async () => {
      await adminApi(`support/${thread.id}/replies`, { method: "POST", body: JSON.stringify({ body: payload.body, request_id: payload.id, expected_version: thread.version }) })
      setReply(""); pendingReply.current = null
    }, "Reply saved. Notification delivery is shown separately.")
  }
  return <section className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
    <h1 className="text-2xl font-semibold">Support conversations</h1>
    <p className="text-sm text-muted-foreground">Reply to customers here. Private staff notes are never sent to customers. This inbox is not an emergency service.</p>
    <label className="block max-w-xs text-sm">Filter support status<select className={field} value={status} disabled={busy} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">All</option><option value="open">Open</option><option value="resolved">Resolved</option></select></label>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="min-w-0 space-y-3">
        {list.state?.error ? <p role="alert">{list.state.error}</p> : !list.state?.data ? <p role="status">Loading conversations…</p> : <>
          {list.state.data.data.length === 0 && <p>No conversations match this filter.</p>}
          {list.state.data.data.map(row => <Button className="h-auto min-h-12 w-full justify-start whitespace-normal text-left" variant="outline" disabled={busy} key={row.id} onClick={() => choose(row.id)}>{row.subject} · {row.status} · #{row.id}</Button>)}
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="self-center">Page {page}</span><Button variant="outline" disabled={busy || page >= list.state.data.last_page} onClick={() => setPage(value => value + 1)}>Next</Button></div>
        </>}
        <Button variant="outline" disabled={busy} onClick={list.refresh}>Refresh list</Button>
      </div>
      <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4">
        {selected === null ? <p>Select a conversation.</p> : <>
          <Button variant="outline" disabled={busy} onClick={() => setRevision(value => value + 1)}>Refresh conversation</Button>
          {!thread ? <p role="status">{error ? "Conversation could not be loaded." : "Loading conversation…"}</p> : <>
            <h2 className="text-xl font-semibold">{thread.subject}</h2><p>Status: {thread.status}</p>
            <p className="whitespace-pre-wrap rounded-lg border p-3">Customer: {thread.message}</p>
            <ol className="space-y-3">{thread.messages.map(row => <li key={row.id} className="space-y-2 rounded-lg border p-3"><p className="text-sm font-medium">{row.author === "customer" ? "Customer" : "Support"} · {row.created_at}</p><p className="whitespace-pre-wrap">{row.body}</p>{row.notification_status && <><p className="text-xs">Email notification: {row.notification_status}</p>{["failed", "bounced", "suppressed"].includes(row.notification_status) && <Button variant="outline" disabled={busy} onClick={() => void run(() => adminApi(`support/${thread.id}/messages/${row.id}/retry`, { method: "POST", body: "{}" }), "Notification retry queued; reply unchanged.")}>Retry notification</Button>}</>}</li>)}</ol>
            <label className="block text-sm">Customer reply<textarea aria-label="Customer reply" className={field} rows={5} maxLength={10000} value={reply} disabled={busy} onChange={event => setReply(event.target.value)} /></label>
            <Button disabled={busy || !reply.trim()} onClick={send}>Send reply</Button>
            <div className="space-y-3 border-t pt-4"><label className="block text-sm">Private staff note<textarea aria-label="Private staff note" className={field} maxLength={2000} rows={4} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
              <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void run(() => adminApi(`support/${thread.id}`, { method: "PUT", body: JSON.stringify({ status: thread.status, admin_notes: note, expected_version: thread.record_version }) }), "Private note saved.")}>Save private note</Button><Button variant="outline" disabled={busy} onClick={() => void run(() => adminApi(`support/${thread.id}`, { method: "PUT", body: JSON.stringify({ status: thread.status === "open" ? "resolved" : "open", expected_version: thread.record_version }) }), thread.status === "open" ? "Conversation resolved." : "Conversation reopened.")}>{thread.status === "open" ? "Resolve conversation" : "Reopen conversation"}</Button></div>
            </div>
          </>}
        </>}
      </div>
    </div>
  </section>
}

export function PrivacyWorkspace() {
  const [page, setPage] = useState(1), [status, setStatus] = useState("")
  const list = useCollection<Privacy>(`privacy-requests?page=${page}${status ? `&status=${status}` : ""}`)
  const [record, setRecord] = useState<Privacy | null>(null), [busy, setBusy] = useState(false)
  const [decision, setDecision] = useState<Decision>("hold"), [outcome, setOutcome] = useState("")
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [confirm, setConfirm] = useState(false)
  async function open(id: string, preserveDraft = false) {
    if (busy) return
    setBusy(true); setError(""); setRecord(null); setConfirm(false)
    try { const data = await adminApi<{ data: Privacy }>(`privacy-requests/${id}`); setRecord(data.data); if (!preserveDraft) { setOutcome(""); setDecision("hold") } }
    catch (error) { setError(message(error)) } finally { setBusy(false) }
  }
  async function process() {
    if (!record || busy || !outcome.trim()) return
    setBusy(true); setError("")
    try {
      await adminApi(`privacy-requests/${record.id}/process`, { method: "POST", body: JSON.stringify({ decision, expected_version: record.version, outcome: outcome.trim() }) })
      setNotice("Decision saved. Export contents remain available only to the customer; deletion file cleanup uses the existing queue.")
      setRecord(null); setConfirm(false); list.refresh()
    } catch (error) { setError(`${message(error)} Your explanation is still here. Reopen the request to obtain its current state before another decision.`); setConfirm(false) }
    finally { setBusy(false) }
  }
  return <section className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
    <h1 className="text-2xl font-semibold">Privacy requests</h1>
    <p className="text-sm text-muted-foreground">Process identity-verified customer requests. Support and moderation permissions do not grant privacy access. Exports are downloaded by the customer.</p>
    <label className="block max-w-xs text-sm">Filter privacy status<select className={field} disabled={busy} value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">All</option>{["pending", "processing", "held", "completed", "declined", "failed"].map(value => <option key={value}>{value}</option>)}</select></label>
    {error && record === null && <p role="alert" className="text-destructive">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!list.state ? <p role="status">Loading requests…</p> : list.state.error ? <p role="alert">{list.state.error}</p> : list.state.data && <>
      {list.state.data.data.length === 0 && <p>No requests match this filter.</p>}
      <div className="space-y-3">{list.state.data.data.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><p>Customer #{row.user_id} · {row.kind} · {row.status}</p><Button variant="outline" disabled={busy} onClick={() => void open(row.id)}>Review {row.kind} request</Button></div>)}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="self-center">Page {page}</span><Button variant="outline" disabled={busy || page >= list.state.data.last_page} onClick={() => setPage(value => value + 1)}>Next</Button></div>
    </>}
    <Button variant="outline" disabled={busy} onClick={list.refresh}>Refresh requests</Button>
    <Dialog open={record !== null} onOpenChange={value => { if (!value && !busy) { setRecord(null); setConfirm(false) } }}><DialogContent className="max-h-[85dvh] min-w-0 overflow-y-auto [overflow-wrap:anywhere]"><DialogHeader><DialogTitle>Review {record?.kind} request</DialogTitle><DialogDescription>Only act on the customer’s verified request. Your explanation is visible to the customer.</DialogDescription></DialogHeader>
      {record && <>{error && <p role="alert" className="text-destructive">{error}</p>}<p>Status: {record.status}</p><Button variant="outline" disabled={busy} onClick={() => void open(record.id, true)}>Refresh request</Button>{record.changes && Object.keys(record.changes).length > 0 && <pre className="whitespace-pre-wrap break-words rounded-lg border p-3 text-sm">{JSON.stringify(record.changes, null, 2)}</pre>}{record.outcome && <p>{record.outcome}</p>}
        {["pending", "held", "failed"].includes(record.status) && <><label className="text-sm">Decision<select aria-label="Decision" className={field} value={decision} disabled={busy || confirm} onChange={event => { const value = event.target.value; if (value === "approve" || value === "hold" || value === "decline") setDecision(value) }}><option value="hold">Hold for clarification</option><option value="approve">Approve requested action</option><option value="decline">Decline with explanation</option></select></label>
          <label className="text-sm">Explanation to customer<textarea aria-label="Explanation to customer" className={field} rows={4} maxLength={1000} value={outcome} disabled={busy} onChange={event => setOutcome(event.target.value)} /></label>
          {confirm ? <div className="space-y-3"><p role="alert">Confirm {decision} for this {record.kind} request.{decision === "approve" && record.kind === "deletion" ? " This removes the customer account and queues private-file cleanup." : ""}</p><Button disabled={busy || !outcome.trim()} onClick={() => void process()}>Confirm decision</Button><Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>Back</Button></div> : <Button disabled={busy || !outcome.trim()} onClick={() => setConfirm(true)}>Review decision</Button>}
        </>}
      </>}
    </DialogContent></Dialog>
  </section>
}
