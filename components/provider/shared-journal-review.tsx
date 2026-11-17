"use client"

import { useEffect, useRef, useState } from "react"
import { api, providerMediaUrl, type SharedJournalCopy } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

/** Explicit online review; full text never enters conversation cache or browser storage. */
export function SharedJournalReview({ conversationId, shareId }: { conversationId: number; shareId: string }) {
  const [open, setOpen] = useState(false)
  const [copy, setCopy] = useState<SharedJournalCopy | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const active = useRef(0)
  const request = useRef<AbortController | null>(null)
  function close() {
    active.current++
    request.current?.abort()
    setOpen(false); setCopy(null); setError(""); setLoading(false)
  }
  async function review() {
    const revision = ++active.current
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setOpen(true); setLoading(true); setCopy(null); setError("")
    try {
      const result = await api<SharedJournalCopy>(`conversations/${conversationId}/journal-shares/${shareId}`, { signal: controller.signal })
      if (revision === active.current && !controller.signal.aborted) setCopy(result)
    } catch {
      if (revision === active.current && !controller.signal.aborted) setError("This copy could not be opened. Access may have changed or you may be offline.")
    } finally {
      if (revision === active.current && !controller.signal.aborted) setLoading(false)
    }
  }
  useEffect(() => {
    const hide = () => { active.current++; request.current?.abort(); setCopy(null); setOpen(false) }
    window.addEventListener("blur", hide)
    document.addEventListener("visibilitychange", hide)
    return () => { active.current++; request.current?.abort(); window.removeEventListener("blur", hide); document.removeEventListener("visibilitychange", hide) }
  }, [])
  return <>
    <Button variant="outline" onClick={() => void review()}>Review shared journal copy</Button>
    <Dialog open={open} onOpenChange={value => { if (!value) close() }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Shared journal copy</DialogTitle><DialogDescription>The patient explicitly shared this copy. Later edits remain private. Access ends when sharing is withdrawn.</DialogDescription></DialogHeader>
        {loading && <p role="status">Loading shared copy…</p>}
        {error && <p role="alert">{error}</p>}
        {copy && <article><h3 className="break-words font-semibold">{copy.entry.title || "Untitled journal"}</h3>
          {copy.entry.kind === "voice" && copy.entry.audio
            ? <SharedVoiceAudio path={`conversations/${conversationId}/journal-shares/${shareId}`} duration={copy.entry.audio.duration} />
            : <p className="mt-3 whitespace-pre-wrap break-words">{copy.entry.body}</p>}
        </article>}
        <Button disabled={loading} variant="outline" onClick={() => void review()}>Refresh copy</Button>
      </DialogContent>
    </Dialog>
  </>
}

function SharedVoiceAudio({ path, duration }: { path: string; duration: number }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const permit = useRef(false)
  const pending = useRef<AbortController | null>(null)
  const [error, setError] = useState(false)
  async function authorize(resume: boolean) {
    const element = audio.current
    if (!element) return
    element.pause()
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    try {
      await api<SharedJournalCopy>(path, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (resume) { permit.current = true; await element.play() }
    } catch {
      if (controller.signal.aborted) return
      element.pause(); element.removeAttribute("src"); element.load(); setError(true)
    }
  }
  useEffect(() => {
    const element = audio.current
    element?.setAttribute("src", providerMediaUrl(`${path}/audio`))
    return () => { pending.current?.abort(); if (element) { element.pause(); element.removeAttribute("src"); element.load() } }
  }, [path])
  return <div className="mt-3 space-y-2">
    <audio ref={audio} controls preload="none" src={providerMediaUrl(`${path}/audio`)} aria-label="Shared voice journal" className="w-full max-w-full" onError={() => setError(true)}
      onPlay={() => { if (permit.current) { permit.current = false; return }; void authorize(true) }}
      onSeeking={() => { void authorize(audio.current?.paused === false) }} />
    <p className="text-sm text-muted-foreground">Voice journal · {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}</p>
    {error && <p role="alert" className="text-sm text-destructive">Could not play this recording. Refresh the copy to check access and retry.</p>}
  </div>
}
