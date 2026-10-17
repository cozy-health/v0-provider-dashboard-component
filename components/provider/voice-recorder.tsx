"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp, Info, Mic, RotateCcw, ShieldCheck, Square, Trash2 } from "lucide-react"
import { api } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { DraftWaveform, VoiceDraftPreview } from "./voice-draft-preview"

export function VoiceRecorder({ conversationId, onSent, onBusy }: { conversationId: number; onSent: () => Promise<void>; onBusy: (busy: boolean) => void }) {
  const [open, setOpen] = useState(false), [recording, setRecording] = useState(false), [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(0), [samples, setSamples] = useState<number[]>([]), [error, setError] = useState("")
  const [showInfo, setShowInfo] = useState(false)
  const sampleHistory = useRef<number[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null)
  const blob = useRef<Blob | null>(null), objectUrl = useRef<string | null>(null)
  const uploadId = useRef<string | null>(null), attachmentId = useRef<string | null>(null), messageId = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null), meter = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContext = useRef<AudioContext | null>(null), started = useRef(0), elapsed = useRef(0), alive = useRef(true)
  function release() {
    if (timer.current) clearInterval(timer.current)
    if (meter.current) clearInterval(meter.current)
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null
    void audioContext.current?.close(); audioContext.current = null
  }
  useEffect(() => {
    alive.current = true
    const background = () => { if (document.hidden && recorder.current?.state === "recording") recorder.current.stop() }
    document.addEventListener("visibilitychange", background)
    return () => {
      alive.current = false
      if (recorder.current) { recorder.current.onstop = null; if (recorder.current.state === "recording") recorder.current.stop() }
      release(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      document.removeEventListener("visibilitychange", background)
    }
  }, [])
  function reset() {
    if (recorder.current) { recorder.current.onstop = null; if (recorder.current.state === "recording") recorder.current.stop() }
    release(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null; blob.current = null; uploadId.current = null; attachmentId.current = null; messageId.current = null
    sampleHistory.current = []; setSamples([])
    setPreview(null); setRecording(false); setSeconds(0)
  }
  async function start() {
    setOpen(true); setError(""); setBusy(true); onBusy(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Recording is unavailable in this browser. Use a supported browser with HTTPS.")
      const input = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!alive.current) { input.getTracks().forEach(track => track.stop()); return }
      reset(); stream.current = input
      const mimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type))
      if (!mimeType) throw new Error("No supported audio recording format is available.")
      const capture = new MediaRecorder(input, { mimeType, audioBitsPerSecond: 64000 }), chunks: Blob[] = []
      recorder.current = capture; let size = 0
      capture.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); size += event.data.size; if (size > 20 * 1024 * 1024 && capture.state === "recording") capture.stop() } }
      capture.onerror = () => { release(); if (alive.current) { setRecording(false); setError("Recording was interrupted. Please record again.") } }
      capture.onstop = () => {
        elapsed.current = Math.min(300, Math.max(1, Math.ceil((Date.now() - started.current) / 1000)))
        release(); if (!alive.current) return
        setRecording(false); setSeconds(elapsed.current)
        const result = new Blob(chunks, { type: mimeType })
        if (!result.size || result.size > 20 * 1024 * 1024) { setError("Recording is empty or exceeds 20 MB. Please record again."); return }
        blob.current = result; uploadId.current = crypto.randomUUID(); messageId.current = crypto.randomUUID()
        objectUrl.current = URL.createObjectURL(result); setPreview(objectUrl.current)
      }
      capture.start(250); started.current = Date.now(); setRecording(true)
      timer.current = setInterval(() => { const value = Math.floor((Date.now() - started.current) / 1000); setSeconds(Math.min(value, 300)); if (value >= 300 && capture.state === "recording") capture.stop() }, 200)
      try {
        const context = new AudioContext(); audioContext.current = context
        const analyser = context.createAnalyser(); analyser.fftSize = 256; context.createMediaStreamSource(input).connect(analyser)
        const buffer = new Uint8Array(analyser.fftSize)
        meter.current = setInterval(() => {
          analyser.getByteTimeDomainData(buffer)
          const rms = Math.sqrt(buffer.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / buffer.length)
          sampleHistory.current.push(Math.min(1, Math.sqrt(rms) * 2))
          setSamples([...sampleHistory.current])
        }, 120)
      } catch { /* Recording remains usable when browser metering is unavailable. */ }
    } catch (e) { release(); setError(e instanceof Error ? e.message : "Microphone access is needed to record.") }
    finally { if (alive.current) { setBusy(false) } }
  }
  async function send() {
    if (!blob.current || !uploadId.current || !messageId.current) return
    setBusy(true); onBusy(true); setError("")
    try {
      if (!attachmentId.current) {
        const form = new FormData()
        form.set("audio", blob.current, blob.current.type.includes("mp4") ? "voice.m4a" : blob.current.type.includes("ogg") ? "voice.ogg" : "voice.webm")
        form.set("client_id", uploadId.current); form.set("purpose", "message"); form.set("provider_client_link_id", String(conversationId)); form.set("duration", String(elapsed.current))
        const audio = await api<{ id: string }>("audio-attachments", { method: "POST", body: form }); attachmentId.current = audio.id
      }
      await api(`conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ client_id: messageId.current, audio_attachment_id: attachmentId.current }) })
      reset(); setOpen(false); onBusy(false); await onSent()
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send. Your recording is ready to retry.") }
    finally { if (alive.current) { setBusy(false) } }
  }
  return <div className="relative shrink-0">
    <Popover open={open}>
    <PopoverAnchor asChild><Button type="button" variant="outline" aria-label="Record voice message" aria-expanded={open} disabled={busy || recording} onClick={() => void start()}><Mic className="size-4" /></Button></PopoverAnchor>
    <PopoverContent side="top" align="end" sideOffset={10} collisionPadding={16} onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => event.preventDefault()} onOpenAutoFocus={event => event.preventDefault()} aria-label="Voice message recorder" className="max-h-[min(430px,var(--radix-popover-content-available-height))] w-[min(320px,calc(100vw-32px))] overflow-y-auto rounded-3xl border-border/70 bg-card p-5 text-card-foreground shadow-[0_12px_45px_-12px_rgba(4,96,216,0.22)]">
      <header className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Mic className="size-5" /></span>
        <h3 className="flex-1 text-sm font-semibold tracking-tight">Voice message</h3>
        <Button type="button" size="icon" variant="ghost" aria-label="How is this saved?" aria-expanded={showInfo} onClick={() => setShowInfo(value => !value)} className="size-8 rounded-full text-muted-foreground"><Info className="size-4" /></Button>
      </header>
      <div className="mb-3.5 mt-5 text-center">
        <div role="status" className="flex items-center justify-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">{recording && <span className="size-1.5 rounded-full bg-orange-500 motion-safe:animate-pulse" />}{recording ? "Recording" : preview ? "Preview voice message" : "Ready when you are"}</div>
        <div className="mt-0.5 text-[38px] leading-tight font-medium tracking-[-0.06em] tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</div>
      </div>
      <div className="rounded-2xl bg-primary/[0.055] px-3 py-1 text-primary">
        {preview ? <VoiceDraftPreview key={preview} source={preview} samples={samples} disabled={busy} duration={seconds} /> : <div role="img" aria-label="Live microphone waveform"><DraftWaveform samples={samples} recording={recording} /></div>}
      </div>
      <p className="mt-2.5 text-center text-[11px] leading-relaxed text-muted-foreground">{preview ? "Listen back. Send when you are ready." : "A quiet space. A moment for your voice."}</p>
      {showInfo && <div className="mt-3 rounded-xl bg-muted/70 p-3 text-[11px] leading-relaxed text-muted-foreground"><div className="mb-1 flex items-center gap-1.5 font-medium text-foreground"><ShieldCheck className="size-3.5" />Private until you send</div>Kept in this browser until you tap Send, then uploaded privately for you and the patient. Keep this card open to retry a failed send. Maximum 5 minutes.</div>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/5 p-2.5 text-xs leading-relaxed text-destructive">{error}</p>}
      {busy && <div role="progressbar" aria-label={preview ? "Sending voice message" : "Preparing microphone"} className="mt-3 h-0.5 overflow-hidden rounded-full bg-primary/10"><div className="h-full w-1/2 rounded-full bg-primary motion-safe:animate-pulse" /></div>}
      <footer className="mt-4 flex items-center justify-between gap-2">
        <Button type="button" size="icon" variant="outline" aria-label="Discard recording" disabled={busy} onClick={() => { reset(); setOpen(false); onBusy(false) }} className="size-11 rounded-full border-border/70 text-muted-foreground"><Trash2 className="size-[18px]" /></Button>
        {recording ? <><Button type="button" aria-label="Stop" size="icon" className="size-[60px] rounded-full shadow-lg shadow-primary/15" onClick={() => recorder.current?.stop()}><Square className="size-5 fill-current" /></Button><span className="w-11 text-center text-[10px] leading-relaxed text-muted-foreground">5:00<br />max</span></> : <>
          <Button type="button" variant="outline" size="icon" aria-label="Record again" disabled={busy} onClick={() => void start()} className="size-11 rounded-full border-border/70 text-muted-foreground"><RotateCcw className="size-[18px]" /></Button>
          {preview ? <Button type="button" disabled={busy} onClick={() => void send()} className="h-11 rounded-full px-5 shadow-md shadow-primary/10"><ArrowUp className="size-4" />{busy ? "Sending…" : "Send"}</Button> : <span className="text-[10px] text-muted-foreground">5 minute limit</span>}
        </>}
      </footer>
    </PopoverContent>
    </Popover>
  </div>
}
