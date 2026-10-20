"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DraftWaveform({ samples, progress = 0, recording = false }: { samples: readonly number[]; progress?: number; recording?: boolean }) {
  return <svg viewBox="0 0 240 56" preserveAspectRatio="none" aria-hidden="true" className="h-14 w-full">
    {Array.from({ length: 48 }, (_, bar) => {
      const start = Math.floor(bar * samples.length / 48), end = Math.min(samples.length, Math.ceil((bar + 1) * samples.length / 48))
      let peak = 0
      for (let index = start; index < end; index++) peak = Math.max(peak, samples[index] ?? 0)
      const height = 3 + Math.min(1, Math.max(0, peak)) * 46
      return <rect key={bar} x={bar * 5 + 1} y={(56 - height) / 2} width={2.7} height={height} rx={1.35} fill="currentColor" opacity={recording || bar / 48 <= progress ? 1 : .23} />
    })}
  </svg>
}

export function VoiceDraftPreview({ source, samples, disabled, duration }: { source: string; samples: readonly number[]; disabled: boolean; duration: number }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState("")
  useEffect(() => { if (disabled) audio.current?.pause() }, [disabled])
  function seek(value: number) {
    const player = audio.current
    if (!player || disabled) return
    const total = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : duration
    if (total <= 0) return
    const next = Math.max(0, Math.min(1, value)); player.currentTime = total * next; setProgress(next)
  }
  async function toggle() {
    const player = audio.current; if (!player) return
    setError("")
    if (player.paused) {
      if (player.ended) player.currentTime = 0
      try { await player.play() } catch { setError("Could not play the preview. Please try again.") }
    } else player.pause()
  }
  return <div>
    <audio ref={audio} src={source} preload="metadata" aria-label="Preview recording"
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setProgress(1) }}
      onTimeUpdate={event => { const player = event.currentTarget; const total = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : duration; if (total > 0) setProgress(Math.min(1, player.currentTime / total)) }}
      onError={() => setError("Could not load the preview. You can record again.")} />
    <div className="flex items-center gap-3">
      <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={playing ? "Pause preview" : "Play preview"} onClick={() => void toggle()} className="size-10 shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary/20"><span>{playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}</span></Button>
      <div role="slider" aria-label="Preview position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
        className="min-w-0 flex-1 cursor-pointer touch-none rounded-md text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onPointerDown={event => { const bounds = event.currentTarget.getBoundingClientRect(); event.currentTarget.setPointerCapture(event.pointerId); seek((event.clientX - bounds.left) / bounds.width) }}
        onPointerMove={event => { if (event.buttons === 1) { const bounds = event.currentTarget.getBoundingClientRect(); seek((event.clientX - bounds.left) / bounds.width) } }}
        onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); seek(event.key === "Home" ? 0 : event.key === "End" ? 1 : progress + (event.key === "ArrowRight" ? .05 : -.05)) } }}>
        <DraftWaveform samples={samples} progress={progress} />
      </div>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
  </div>
}
