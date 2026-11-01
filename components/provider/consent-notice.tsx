"use client"

import { useEffect, useState, useRef, type ReactNode } from "react"
import { api, ApiError } from "@/lib/provider-api"
import { blockingConsent, pendingConsents, consentDocumentsAvailable } from "@/lib/consent-state.mjs"
import { legalUrl } from "@/lib/legal-url"
import { Button } from "@/components/ui/button"
import { Failure, Loading } from "./data-list"

type Document = { title: string; version: string; published: boolean; required: boolean; content: string | null; url?: string }
type Configuration = { enforce_blocking: boolean; documents_ready?: boolean; documents: Record<string, Document> }
type Consent = { document_type: string; version: string; status: string }
function isConsentRecord(value: unknown): value is Consent {
  return !!value && typeof value === "object" && "document_type" in value && typeof value.document_type === "string" && "version" in value && typeof value.version === "string" && "status" in value && typeof value.status === "string"
}

function policyKey(policy: Configuration) {
  return JSON.stringify([policy.enforce_blocking, policy.documents_ready, Object.entries(policy.documents).filter(([type, doc]) => type !== "marketing" && doc.required).sort(([left], [right]) => left.localeCompare(right)).map(([type, doc]) => [type, doc.version, doc.published, doc.required, doc.content])])
}

export function ConsentNotice({ ownerId, children }: { ownerId: number; children: ReactNode }) {
  const activeOwner = useRef(ownerId)
  const activeConfig = useRef<Configuration | null>(null)
  const verifiedConfig = useRef<Configuration | null>(null)
  const [loadedOwner, setLoadedOwner] = useState<number | null>(null)
  const [config, setConfig] = useState<Configuration | null>(null)
  const [records, setRecords] = useState<Consent[]>([])
  const [historyReady, setHistoryReady] = useState(false)
  const [serverRequired, setServerRequired] = useState(false)
  const [revision, setRevision] = useState(0)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const accountChanged = activeOwner.current !== ownerId
    activeOwner.current = ownerId
    if (accountChanged) { activeConfig.current = null; verifiedConfig.current = null }
    let alive = true, request = 0
    async function load() {
      const current = ++request
      try {
        const response = await api<{ consent: Configuration }>("consent-config")
        if (!alive || current !== request) return
        const policy = response?.consent
        if (!policy || typeof policy.enforce_blocking !== "boolean" || !policy.documents || typeof policy.documents !== "object" || Array.isArray(policy.documents) || (policy.documents_ready !== undefined && typeof policy.documents_ready !== "boolean") || !Object.values(policy.documents).every(doc => doc && typeof doc.title === "string" && typeof doc.version === "string" && typeof doc.published === "boolean" && typeof doc.required === "boolean" && (doc.content === null || typeof doc.content === "string"))) throw new Error("Consent policy is unavailable.")
        // Preserve same-account drafts when rechecking an unchanged, confirmed policy.
        const unchanged = activeConfig.current !== null && policyKey(activeConfig.current) === policyKey(policy)
        if (!unchanged) { activeConfig.current = policy; verifiedConfig.current = null; setHistoryReady(false) }
        setConfig(policy); setLoadedOwner(ownerId)
        const existing = await api<{ owner_id: number; data: Consent[] }>("me/consents")
        if (!alive || current !== request) return
        if (existing?.owner_id !== ownerId || !Array.isArray(existing.data) || !existing.data.every(isConsentRecord)) throw new Error("Your account changed. Review again.")
        const values = [...existing.data]
        if (!policy.enforce_blocking && !serverRequired) {
          for (const [type, doc] of pendingConsents(policy, values) as [string, Document][]) {
            if (!doc.published && !values.some(record => record.document_type === type)) {
              const saved = await api<{ owner_id: number; data: Consent }>("me/consents", { method: "POST", body: JSON.stringify({ document_type: type, version: doc.version, accepted: false, pre_acceptance: true, actor_id: ownerId }) })
              if (!alive || current !== request) return
              if (saved?.owner_id !== ownerId || !isConsentRecord(saved.data)) throw new Error("Your account changed. Review again.")
              values.push(saved.data)
            }
          }
        }
        if (alive && current === request) { verifiedConfig.current = activeConfig.current; setRecords(values); setHistoryReady(true); setError(null); if (accountChanged) setDismissed([]) }
      } catch (failure) {
        if (alive && current === request) {
          const temporary = failure instanceof TypeError || (failure instanceof ApiError && (failure.status === 0 || failure.status >= 500))
          if (!temporary || verifiedConfig.current === null || verifiedConfig.current !== activeConfig.current) { verifiedConfig.current = null; setHistoryReady(false) }
          setError("Could not check your consent. Check your connection and try again.")
        }
      }
    }
    const requireConsent = () => { verifiedConfig.current = null; setServerRequired(true); setLoadedOwner(null); setHistoryReady(false); setRevision(value => value + 1) }
    const resume = () => { if (document.visibilityState === "visible") void load() }
    void load()
    document.addEventListener("visibilitychange", resume)
    window.addEventListener("cozy:consent-required", requireConsent)
    return () => { alive = false; document.removeEventListener("visibilitychange", resume); window.removeEventListener("cozy:consent-required", requireConsent) }
  }, [ownerId, revision, serverRequired])
  const retry = () => { setError(null); setRevision(value => value + 1) }
  const policy = config && (serverRequired ? { ...config, enforce_blocking: true } : config)
  const unavailable = policy?.enforce_blocking && !consentDocumentsAvailable(policy)
  if (!policy || loadedOwner !== ownerId || (policy.enforce_blocking && (!historyReady || unavailable))) {
    return error || unavailable ? <Failure error={unavailable ? "Required consent documents are unavailable. Please try again." : error || "Could not check your consent. Please try again."} retry={retry} /> : <Loading />
  }
  // A paused rollout stays usable even if optional history cannot load.
  if (!historyReady) return <>{null}{children}</>
  const pending = pendingConsents(policy, records) as [string, Document][]
  const required = pending.find(([type, doc]) => blockingConsent(policy, type, doc))
  const next = required || pending.find(([type, doc]) => !dismissed.includes(`${type}:${doc.version}`))
  if (!next) return <>{null}{children}</>
  const [type, doc] = next
  const blocking = !!required
  const canAccept = doc.published && !doc.version.startsWith("draft-") && !!doc.content?.trim()
  async function accept() {
    setBusy(true); setError(null)
    const startedConfig = activeConfig.current
    try {
      const response = await api<{ owner_id: number; data: Consent }>("me/consents", { method: "POST", body: JSON.stringify({ document_type: type, version: doc.version, accepted: true, actor_id: ownerId }) })
      if (response?.owner_id !== ownerId || !isConsentRecord(response.data) || activeOwner.current !== ownerId || startedConfig !== activeConfig.current) throw new Error("Your account or consent documents changed. Review again.")
      setRecords(current => [...current.filter(record => record.document_type !== type || record.version !== doc.version), response.data]); setReviewing(false)
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  const notice = <section role={blocking ? "dialog" : "status"} aria-modal={blocking || undefined} aria-label={doc.title} className={blocking ? "fixed inset-0 z-50 flex items-center justify-center bg-background p-6" : "mb-6 rounded-lg border p-4"}>
    <div className="w-full max-w-3xl space-y-3">
      <p>We&apos;ve updated our {doc.title}. Tap to review.</p>
      {(reviewing || blocking) && <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm">{canAccept ? doc.content : "This document is still a draft. We will notify you when the approved text is published."}</div>}
      {error && <p role="alert">{error}</p>}
      <div className="flex gap-3">
        {legalUrl(doc.url) && <a href={legalUrl(doc.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center underline">Read online</a>}
        {!reviewing && !blocking && <Button variant="outline" onClick={() => setReviewing(true)}>Review</Button>}
        {(reviewing || blocking) && canAccept && <Button disabled={busy} onClick={accept}>{busy ? "Saving…" : "Accept"}</Button>}
        {!blocking && <Button variant="ghost" onClick={() => { setDismissed(current => [...current, `${type}:${doc.version}`]); setReviewing(false) }}>Dismiss</Button>}
      </div>
    </div>
  </section>
  return blocking ? notice : <>{notice}{children}</>
}
