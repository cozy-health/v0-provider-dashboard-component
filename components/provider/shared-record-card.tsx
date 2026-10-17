"use client"

import { useState } from "react"
import { BookOpen, ClipboardCheck, Heart, LockKeyhole, StickyNote } from "lucide-react"

export type SharedRecord = { type: string; id: string; unavailable?: boolean; owner?: { name: string; initials: string }; data?: Record<string, unknown> }
const humanize = (value: unknown) => String(value ?? "").replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()).trim()

export function SharedRecordCard({ record }: { record: SharedRecord }) {
  const [expanded, setExpanded] = useState(false)
  const data = record.data ?? {}
  const kinds = {
    moods: { label: "Mood check-in", icon: Heart, tone: "bg-green-500/10 text-green-600 dark:text-green-400" },
    journals: { label: "Journal summary", icon: BookOpen, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    quizzes: { label: "Assessment result", icon: ClipboardCheck, tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
    notes: { label: "Care note", icon: StickyNote, tone: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  }
  const kind = kinds[record.type as keyof typeof kinds] ?? { label: "Shared record", icon: StickyNote, tone: "bg-muted text-muted-foreground" }
  const Icon = record.unavailable ? LockKeyhole : kind.icon
  let title = kind.label, body = ""
  const highlights: string[] = []
  if (record.unavailable) {
    title = "Record unavailable"
    body = "Access has changed or this record was removed."
  } else {
    switch (record.type) {
      case "moods":
        title = data.mood ? `Feeling ${humanize(data.mood).toLowerCase()}` : "A moment to check in"
        if (data.intensity != null) highlights.push(`Intensity ${data.intensity}`)
        body = String(data.note ?? "")
        break
      case "journals":
        title = String(data.title ?? "").trim() || "Untitled journal"
        highlights.push(data.type === "voice" ? "Voice journal" : "Written journal")
        if (data.word_count != null) highlights.push(`${data.word_count} ${data.word_count === 1 ? "word" : "words"}`)
        body = "A journal summary shared with your provider."
        break
      case "quizzes":
        title = String(data.quiz_title ?? "").trim() || String(data.quiz_slug ?? "Assessment").replaceAll("-", " ").toUpperCase()
        if (data.score != null) highlights.push(`Score ${data.score}${data.maximum_score == null ? "" : ` / ${data.maximum_score}`}`)
        body = humanize(data.interpretation)
        break
      case "notes":
        title = "A note for your care"
        body = String(data.body ?? "")
    }
  }
  const longContent = body.length > 180 || body.split("\n").length > 4
  return <section aria-label={kind.label} className="my-1.5 min-w-0 w-full rounded-2xl border border-border bg-card p-4 text-card-foreground">
    <div className="flex items-center gap-2.5"><span className={`rounded-xl p-2 ${record.unavailable ? "bg-muted text-muted-foreground" : kind.tone}`}><Icon aria-hidden="true" className="size-5" /></span><span className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">{kind.label}</span><span className="text-xs text-muted-foreground">Shared</span></div>
    <h3 className="mt-3.5 break-words text-xl font-semibold tracking-tight">{title}</h3>
    {highlights.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{highlights.map(value => <span key={value} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{value}</span>)}</div>}
    {body.trim() && <p className={`mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground ${expanded || !longContent ? "" : "line-clamp-4"}`}>{body}</p>}
    {longContent && <button type="button" className="mt-2 min-h-10 text-sm font-medium underline underline-offset-4" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Show less" : "Read more"}</button>}
    <div className="mt-3.5 flex items-center gap-2.5 border-t border-border pt-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">{record.owner?.initials || record.owner?.name?.slice(0, 1).toUpperCase() || "P"}</span><div className="min-w-0"><p className="break-words text-sm font-medium">{record.owner?.name ? `Shared by ${record.owner.name}` : "Shared by patient"}</p><p className="text-xs text-muted-foreground">Cozy Health</p></div></div>
  </section>
}
