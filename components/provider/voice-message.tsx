"use client"
import { api, providerMediaUrl } from "@/lib/provider-api"


import { useState } from "react"
import { Button } from "@/components/ui/button"

export function VoiceMessage({ id, duration }: { id: string; duration: number }) {
  const [error, setError] = useState(false), [attempt, setAttempt] = useState(0)
  return <div className="p-2">
    <audio key={attempt} controls preload="none" src={providerMediaUrl(`audio-attachments/${id}`)} aria-label="Voice message" className="max-w-full" onError={() => { setError(true); void api("me").catch(() => {}) }} onLoadedData={() => setError(false)} />
    <span className="text-xs">Voice message · {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}</span>
    {error && <div role="alert" className="text-sm">Could not play this recording. Access may have changed. <Button type="button" variant="ghost" onClick={() => { setError(false); setAttempt(value => value + 1) }}>Retry playback</Button></div>}
  </div>
}
