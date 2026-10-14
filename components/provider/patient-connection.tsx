"use client"

import { useState, type FormEvent } from "react"
import { ShieldCheck, UserRoundPlus } from "lucide-react"
import { api, ApiError, type ConsentType } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

type Invitation = { invitation_id: number; patient_name: string; consent_flags: Record<ConsentType, boolean>; expires_at: string }
const scopeLabels: Record<ConsentType, string> = { moods: "Mood entries, triggers and coping choices", journals: "Journal summaries (no journal body or recordings)", quizzes: "Quiz results", notes: "Provider notes" }
export function PatientConnection({ email, close, connected }: { email: string; close: () => void; connected: () => void }) {
 const [code, setCode] = useState(""), [preview, setPreview] = useState<Invitation | null>(null)
 const [care, setCare] = useState(false), [revocation, setRevocation] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("")
 async function submit(event: FormEvent) {
  event.preventDefault(); if (busy) return
  setBusy(true); setError("")
  try {
   if (!preview) {
    const response = await api<{ data: Invitation }>("invitations/preview", { method: "POST", body: JSON.stringify({ code }) })
    setPreview(response.data)
   } else {
    await api("invitations/connect", { method: "POST", body: JSON.stringify({ code, invitation_id: preview.invitation_id, consent_flags: preview.consent_flags, care_acknowledged: care, revocation_acknowledged: revocation }) })
    connected(); close()
   }
  } catch (err) {
   setError((err as Error).message)
   if (err instanceof ApiError && [409, 422].includes(err.status)) { setPreview(null); setCare(false); setRevocation(false) }
  } finally { setBusy(false) }
 }
 return <Dialog open onOpenChange={open => { if (!open && !busy) close() }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2">{preview ? <ShieldCheck aria-hidden="true" className="size-5 text-primary" /> : <UserRoundPlus aria-hidden="true" className="size-5 text-primary" />}{preview ? "Review patient sharing" : "Add patient"}</DialogTitle><DialogDescription>{preview ? "Review the patient's choices before connecting." : `Enter the six-digit connection code emailed to ${email}. The patient sends this invitation from My Provider in the Cozy app.`}</DialogDescription></DialogHeader>
  <form onSubmit={submit} className="space-y-5"><fieldset disabled={busy} className="space-y-4">
   {!preview ? <div><label htmlFor="patient-code" className="mb-2 block text-sm font-medium">Patient connection code</label><Input id="patient-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} className="text-center text-lg tracking-[0.3em]" /><p className="mt-2 text-sm text-muted-foreground">Codes expire after 15 minutes. Use the latest email.</p></div> : <>
    <p className="text-lg font-semibold">{preview.patient_name}</p>
    <ul className="space-y-2 rounded-xl border p-4">{(Object.keys(scopeLabels) as ConsentType[]).map(type => <li key={type} className="text-sm"><strong>{preview.consent_flags[type] ? "Shared" : "Private"}</strong> - {scopeLabels[type]}</li>)}</ul>
    {!Object.values(preview.consent_flags).some(Boolean) && <p className="text-sm text-muted-foreground">You can connect, but no wellness information will be shared until the patient enables it.</p>}
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={care} onChange={e => setCare(e.target.checked)} className="mt-1" />I will use the shared information only for this patient&apos;s care.</label>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={revocation} onChange={e => setRevocation(e.target.checked)} className="mt-1" />I understand the patient can change or revoke sharing at any time.</label>
   </>}
  </fieldset>
  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => { if (preview) { setPreview(null); setCare(false); setRevocation(false) } else close() }}>{preview ? "Change code" : "Cancel"}</Button><Button disabled={busy || (preview !== null && (!care || !revocation))}>{busy ? "Please wait..." : preview ? "Agree & connect" : "Review invitation"}</Button></div>
  </form>
 </DialogContent></Dialog>
}
