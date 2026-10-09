"use client"

import { useEffect, useState } from "react"

export function useCooldown() {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!until) return
    const timer = setInterval(() => { const time = Date.now(); setNow(time); if (time >= until) clearInterval(timer) }, 1000)
    return () => clearInterval(timer)
  }, [until])
  return { remaining: Math.max(0, Math.ceil((until - now) / 1000)), start(seconds: number) { const time = Date.now(); setNow(time); setUntil(seconds > 0 ? time + seconds * 1000 : 0) } }
}
