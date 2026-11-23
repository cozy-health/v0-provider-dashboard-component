"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { SharedJournalReview } from "./shared-journal-review"
import { VoiceMessage } from "./voice-message"
import { VoiceRecorder } from "./voice-recorder"
import { api } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageCircle, Search, ArrowLeft, SendHorizontal, Info, ArrowUpRight, ShieldCheck } from "lucide-react"
import { Loading } from "./data-list"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SharedRecordCard, type SharedRecord } from "./shared-record-card"

type Thread = { id: number; name: string; user_id: number; unread: number }
type Message = { id: number; sender: string; content: string; records: SharedRecord[]; audio?: { id: string; duration: number } | null; created_at: string }
export function Messages({ userId, onOpenPatient }: { userId?: number; onOpenPatient?: (id: number) => void }) {
  const [contextOpen, setContextOpen] = useState(false)
  const [mobileThreadOpen, setMobileThreadOpen] = useState(Boolean(userId))
  const [threads, setThreads] = useState<Thread[]>([]), [selected, setSelected] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([]), [more, setMore] = useState(false)
  const [draft, setDraft] = useState(""), [sending, setSending] = useState(false), [error, setError] = useState("")
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [messageOwner, setMessageOwner] = useState<number | null>(null)
  const [messageRevision, setMessageRevision] = useState(0)
  const visibleMessages = messageOwner === selected ? messages : []
  const [threadSearch, setThreadSearch] = useState("")
  const oldest = useRef<number | null>(null)
  const feed = useRef<HTMLDivElement>(null)
  const lastMessageId = messages.at(-1)?.id
  useEffect(() => { if (feed.current) feed.current.scrollTop = feed.current.scrollHeight }, [lastMessageId])
  const pending = useRef<{ client_id: string; content: string } | null>(null)
  const refresh = useCallback(async () => {
    try {
      const list = await api<Thread[]>("conversations")
      setThreads(list)
      setSelected(current => current && list.some(t => t.id === current) ? current : list.find(t => t.user_id === userId)?.id ?? list[0]?.id ?? null)
      setError("")
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [userId])
  useEffect(() => { const initial = setTimeout(() => void refresh(), 0); const timer = setInterval(() => { if (!document.hidden) void refresh() }, 5000); return () => { clearTimeout(initial); clearInterval(timer) } }, [refresh])
  useEffect(() => {
    setContextOpen(false)
    if (!selected) return
    let active = true, busy = false
    oldest.current = null; pending.current = null
    async function load() {
      if (busy || document.hidden) return
      busy = true
      try {
        const page = await api<{ data: Message[]; has_more: boolean }>(`conversations/${selected}/messages${oldest.current ? `?since=${oldest.current}` : ""}`)
        if (!active) return
        setMessages(page.data); setMessageOwner(selected); oldest.current = page.data[0]?.id ?? null
        setMore(page.has_more)
        if (page.data.length) await api(`conversations/${selected}/read`, { method: "POST", body: JSON.stringify({ through: page.data.at(-1)!.id }) })
      } catch (e) { if (active) { setMessages([]); setMessageOwner(selected); setError((e as Error).message) } }
      finally { busy = false }
    }
    const initial = setTimeout(() => { setMessages([]); setDraft(""); setMore(false); void load() }, 0)
    const timer = setInterval(() => void load(), 5000)
    return () => { active = false; clearTimeout(initial); clearInterval(timer) }
  }, [selected, messageRevision])
  async function older() {
    const first = messages[0]
    if (!selected || !first) return
    try {
      const page = await api<{ data: Message[]; has_more: boolean }>(`conversations/${selected}/messages?before=${first.id}`)
      setMessages(old => [...page.data, ...old]); oldest.current = page.data[0]?.id ?? oldest.current; setMore(page.has_more)
    } catch (e) { setError((e as Error).message) }
  }
  async function send() {
    if (!selected || sending || voiceBusy || !draft.trim()) return
    const payload = pending.current?.content === draft.trim() ? pending.current : { client_id: crypto.randomUUID(), content: draft.trim() }
    pending.current = payload; setSending(true); setError("")
    try {
      await api(`conversations/${selected}/messages`, { method: "POST", body: JSON.stringify(payload) })
      pending.current = null; setDraft("")
      const page = await api<{ data: Message[] }>(`conversations/${selected}/messages`)
      setMessages(old => [...old.filter(m => m.id < (page.data[0]?.id ?? 0)), ...page.data])
    } catch (e) { setError((e as Error).message) }
    finally { setSending(false) }
  }
  if (loading) return <Loading />
  return <div className="workspace-panel workspace-messenger workspace-messages" data-mobile-thread={mobileThreadOpen}>
    <aside aria-label="Conversations" className="workspace-thread-list"><div className="mb-5 flex items-center justify-between"><h2 className="text-base font-semibold">Conversations</h2><span className="rounded-lg bg-background px-2 py-1 text-xs text-muted-foreground">{threads.length}</span></div><div className="relative mb-4"><Search className="pointer-events-none absolute left-3 top-3.5 text-muted-foreground" size={16} aria-hidden="true" /><Input aria-label="Search conversations" placeholder="Find a conversation" className="pl-9" value={threadSearch} onChange={event => setThreadSearch(event.target.value)} /></div><div className="space-y-2">{threads.length ? threads.filter(t => t.name.toLocaleLowerCase().includes(threadSearch.toLocaleLowerCase())).map(t => <Button disabled={sending || voiceBusy} key={t.id} variant="ghost" aria-label={t.name} aria-description={t.unread ? `${t.unread} unread messages` : "Open conversation"} aria-pressed={selected === t.id} className="workspace-thread-item" onClick={() => { setSelected(t.id); setMobileThreadOpen(true); setError("") }}><span className="workspace-avatar" aria-hidden="true">{t.name.slice(0, 1).toUpperCase()}</span><span className="thread-copy"><strong>{t.name}</strong><small>{selected === t.id && visibleMessages.length ? visibleMessages.at(-1)?.content || "Shared record or voice message" : t.unread ? `${t.unread} unread messages` : "Open conversation"}</small></span>{t.unread > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{t.unread}</span>}</Button>) : <p className="px-2 text-xs leading-relaxed text-muted-foreground">No connected patients yet. Accept a patient invitation from Patients to start a conversation.</p>}{threads.length > 0 && !threads.some(t => t.name.toLocaleLowerCase().includes(threadSearch.toLocaleLowerCase())) && <p className="p-3 text-sm text-muted-foreground">No conversations match your search.</p>}</div></aside>
    <section aria-label="Conversation" className="workspace-conversation">
      <header className="workspace-conversation-heading"><Button type="button" variant="ghost" size="icon" className="workspace-message-back" aria-label="Back to conversations" onClick={() => setMobileThreadOpen(false)}><ArrowLeft size={18} /></Button><span className="workspace-stat-icon"><MessageCircle size={18} aria-hidden="true" /></span><div><h2 className="font-semibold">{threads.find(t => t.id === selected)?.name ?? "Patient messages"}</h2><p className="mt-1 text-xs text-muted-foreground">Private conversation · Shared records stay permission-controlled</p></div>{selected && <Button type="button" className="message-context-button ml-auto" variant="ghost" size="icon" aria-label="Patient context" title="Patient context" onClick={() => setContextOpen(true)}><Info size={19} /></Button>}</header>
      {error && <div role="alert" className="workspace-reading-note my-4">{error} <Button variant="outline" onClick={() => { setError(""); setMessageOwner(null); setMessageRevision(n => n + 1); void refresh() }}>Retry</Button></div>}
      <div ref={feed} className="workspace-message-feed" aria-live="polite">
        {selected && messageOwner !== selected && <Loading />}
        {selected && more && visibleMessages.length > 0 && <Button variant="ghost" onClick={older}>Load earlier messages</Button>}
        {selected && messageOwner === selected && !visibleMessages.length && !error && <div className="workspace-empty"><span className="workspace-empty-symbol"><MessageCircle size={26} aria-hidden="true" /></span><h3>Start a conversation</h3><p>Send your patient a message using the composer below.</p></div>}
        {!selected && <div className="workspace-empty h-full"><span className="workspace-empty-symbol"><MessageCircle size={28} aria-hidden="true" /></span><h3>A space for conversation</h3><p>Once a patient is connected, choose their conversation here to send a message and review the records they share.</p></div>}
        {(selected ? visibleMessages : []).map((m, index) => <Fragment key={m.id}>{(index === 0 || new Date(visibleMessages[index - 1]?.created_at ?? "").toDateString() !== new Date(m.created_at).toDateString()) && <p className="workspace-message-date">{new Date(m.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>}<article data-direction={m.sender === "provider" ? "outgoing" : "incoming"} className={`rounded-2xl ${m.records.length ? "w-full max-w-[94%] sm:max-w-lg " + (m.sender === "provider" ? "self-end" : "self-start") : "max-w-[90%] p-3 sm:max-w-[75%] " + (m.sender === "provider" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted")}`}>
          {m.records.map(r => r.type === "journal_shares" && selected !== null ? <SharedJournalReview key={`${selected}-${r.id}`} conversationId={selected} shareId={r.id} /> : <SharedRecordCard key={`${r.type}-${r.id}`} record={r} />)}
          {m.audio && <VoiceMessage id={m.audio.id} duration={m.audio.duration} />}
          <p className="whitespace-pre-wrap break-words">{m.content}</p>{m.records.length === 0 && <time className="mt-1 block text-right text-xs opacity-75">{new Date(m.created_at).toLocaleString()}</time>}
        </article></Fragment>)}
      </div>
      <form className="workspace-message-composer flex flex-wrap items-end justify-end gap-2 border-t" onSubmit={e => { e.preventDefault(); void send() }}><textarea aria-label="Message" placeholder="Write a message…" maxLength={5000} disabled={!selected || sending || voiceBusy} value={draft} onChange={e => setDraft(e.target.value)} className="min-h-12 max-h-40 w-full min-w-0 resize-y rounded-xl border bg-background p-3 text-base sm:w-auto sm:flex-1 sm:text-sm" />{selected && !sending && <VoiceRecorder key={selected} conversationId={selected} onBusy={setVoiceBusy} onSent={async () => { const page = await api<{ data: Message[] }>(`conversations/${selected}/messages`); setMessages(page.data) }} />}<Button type="submit" disabled={!selected || sending || voiceBusy || !draft.trim()}><SendHorizontal size={16} aria-hidden="true" />{sending ? "Sending…" : error ? "Retry send" : "Send"}</Button></form>
    </section>
    <Sheet open={contextOpen} onOpenChange={setContextOpen}><SheetContent className="message-patient-context"><SheetHeader><SheetTitle>Patient context</SheetTitle><SheetDescription>Information for the selected conversation.</SheetDescription></SheetHeader><div className="space-y-6 p-6"><div className="context-person"><span className="workspace-avatar">{threads.find(t => t.id === selected)?.name.slice(0,1)}</span><h3>{threads.find(t => t.id === selected)?.name}</h3><p>Patient #{threads.find(t => t.id === selected)?.user_id}</p></div><dl className="workspace-details"><div><dt>Loaded messages</dt><dd>{visibleMessages.length}{more ? ' · earlier messages available' : ''}</dd></div><div><dt>Shared items in these messages</dt><dd>{visibleMessages.reduce((count,message) => count + message.records.length,0)}</dd></div></dl><div className="workspace-reading-note"><ShieldCheck size={18} className="mb-3 text-primary" /><p>Patients choose what they share. Each record checks current access when you open it.</p></div>{onOpenPatient && <Button className="w-full" onClick={() => { const thread = threads.find(t => t.id === selected); if (thread) { setContextOpen(false); onOpenPatient(thread.user_id) } }}>Open patient workspace<ArrowUpRight size={15} /></Button>}</div></SheetContent></Sheet>
  </div>
}
