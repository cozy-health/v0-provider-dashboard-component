"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/provider-api"
import { blockingConsent, pendingConsents } from "@/lib/consent-state.mjs"
import { Button } from "@/components/ui/button"

type Document = { title: string; version: string; published: boolean; required: boolean; content: string | null }
type Configuration = { enforce_blocking: boolean; documents: Record<string, Document> }
type Consent = { document_type: string; version: string; status: string }

export function ConsentNotice({ ownerId }: { ownerId: number }) {
  const [config, setConfig] = useState<Configuration | null>(null)
  const [records, setRecords] = useState<Consent[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    async function load() {
      const response = await api<{ consent: Configuration }>("consent-config")
      const existing = await api<{ owner_id: number; data: Consent[] }>("me/consents")
      if (!alive || existing.owner_id !== ownerId) return
      const values = [...existing.data]
      for (const [type, doc] of pendingConsents(response.consent, values) as [string, Document][]) {
        if (!doc.published && !values.some(record => record.document_type === type)) {
          const saved = await api<{ owner_id: number; data: Consent }>("me/consents", { method: "POST", body: JSON.stringify({ document_type: type, version: doc.version, accepted: false, pre_acceptance: true, actor_id: ownerId }) })
          if (!alive || saved.owner_id !== ownerId) return
          values.push(saved.data)
        }
      }
      if (alive) { setConfig(response.consent); setRecords(values) }
    }
    load().catch(() => { /* Draft rollout remains available during connection failures. */ })
    const resume = () => { if (document.visibilityState === "visible") load().catch(() => {}) }
    document.addEventListener("visibilitychange", resume)
    return () => { alive = false; document.removeEventListener("visibilitychange", resume) }
  }, [ownerId])
  if (!config) return null
  const pending = pendingConsents(config, records) as [string, Document][]
  const required = pending.find(([type, doc]) => blockingConsent(config, type, doc))
  const next = required || pending.find(([type, doc]) => !dismissed.includes(`${type}:${doc.version}`))
  if (!next) return null
  const [type, doc] = next
  const blocking = !!required
  const canAccept = doc.published && !doc.version.startsWith("draft-") && !!doc.content?.trim()
  async function accept() {
    setBusy(true); setError(null)
    try {
      const response = await api<{ owner_id: number; data: Consent }>("me/consents", { method: "POST", body: JSON.stringify({ document_type: type, version: doc.version, accepted: true, actor_id: ownerId }) })
      if (response.owner_id !== ownerId) throw new Error("Your account changed. Review again.")
      setRecords(current => [...current.filter(record => record.document_type !== type || record.version !== doc.version), response.data]); setReviewing(false)
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return <section role={blocking ? "dialog" : "status"} aria-modal={blocking || undefined} aria-label={doc.title} className={blocking ? "fixed inset-0 z-50 flex items-center justify-center bg-background p-6" : "mb-6 rounded-lg border p-4"}>
    <div className="w-full max-w-3xl space-y-3">
      <p>We&apos;ve updated our {doc.title}. Tap to review.</p>
      {(reviewing || blocking) && <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm">{canAccept ? doc.content : "This document is still a draft. We will notify you when the approved text is published."}</div>}
      {error && <p role="alert">{error}</p>}
      <div className="flex gap-3">
        {!reviewing && !blocking && <Button variant="outline" onClick={() => setReviewing(true)}>Review</Button>}
        {(reviewing || blocking) && canAccept && <Button disabled={busy} onClick={accept}>{busy ? "Saving…" : "Accept"}</Button>}
        {!blocking && <Button variant="ghost" onClick={() => { setDismissed(current => [...current, `${type}:${doc.version}`]); setReviewing(false) }}>Dismiss</Button>}
      </div>
    </div>
  </section>
}
