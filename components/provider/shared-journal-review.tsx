"use client"

import { useEffect, useRef, useState } from "react"
import { api, type SharedJournalCopy } from "@/lib/provider-api"
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
        <DialogHeader><DialogTitle>Shared written journal copy</DialogTitle><DialogDescription>The patient explicitly shared this copy. Later edits remain private. Audio is excluded.</DialogDescription></DialogHeader>
        {loading && <p role="status">Loading shared copy…</p>}
        {error && <p role="alert">{error}</p>}
        {copy && <article><h3 className="break-words font-semibold">{copy.entry.title || "Untitled journal"}</h3><p className="mt-3 whitespace-pre-wrap break-words">{copy.entry.body}</p></article>}
        <Button disabled={loading} variant="outline" onClick={() => void review()}>Refresh copy</Button>
      </DialogContent>
    </Dialog>
  </>
}
