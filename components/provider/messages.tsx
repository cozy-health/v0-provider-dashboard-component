"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Loading } from "./data-list"
import { SharedRecordCard, type SharedRecord } from "./shared-record-card"

type Thread = { id: number; name: string; user_id: number; unread: number }
type Message = { id: number; sender: string; content: string; records: SharedRecord[]; created_at: string }
export function Messages({ userId }: { userId?: number }) {
  const [threads, setThreads] = useState<Thread[]>([]), [selected, setSelected] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([]), [more, setMore] = useState(false)
  const [draft, setDraft] = useState(""), [sending, setSending] = useState(false), [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
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
    if (!selected) return
    let active = true, busy = false
    oldest.current = null; pending.current = null
    async function load() {
      if (busy || document.hidden) return
      busy = true
      try {
        const page = await api<{ data: Message[]; has_more: boolean }>(`conversations/${selected}/messages${oldest.current ? `?since=${oldest.current}` : ""}`)
        if (!active) return
        setMessages(page.data); oldest.current = page.data[0]?.id ?? null
        setMore(page.has_more)
        if (page.data.length) await api(`conversations/${selected}/read`, { method: "POST", body: JSON.stringify({ through: page.data.at(-1)!.id }) })
      } catch (e) { if (active) { setMessages([]); setError((e as Error).message) } }
      finally { busy = false }
    }
    const initial = setTimeout(() => { setMessages([]); setDraft(""); setMore(false); void load() }, 0)
    const timer = setInterval(() => void load(), 5000)
    return () => { active = false; clearTimeout(initial); clearInterval(timer) }
  }, [selected])
  async function older() {
    try {
      const page = await api<{ data: Message[]; has_more: boolean }>(`conversations/${selected}/messages?before=${messages[0].id}`)
      setMessages(old => [...page.data, ...old]); oldest.current = page.data[0]?.id ?? oldest.current; setMore(page.has_more)
    } catch (e) { setError((e as Error).message) }
  }
  async function send() {
    if (!selected || sending || !draft.trim()) return
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
  return <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
    <aside aria-label="Conversations" className="space-y-2">{threads.length ? threads.map(t => <Button disabled={sending} key={t.id} variant={selected === t.id ? "secondary" : "outline"} className="h-auto w-full justify-between whitespace-normal text-left" onClick={() => { setSelected(t.id); setError("") }}>{t.name}{t.unread > 0 && <span className="rounded-full bg-primary px-2 text-primary-foreground">{t.unread}</span>}</Button>) : <p>No connected patients yet.</p>}</aside>
    <section aria-label="Conversation" className="min-w-0 rounded-2xl border bg-card p-4">
      <h2 className="mb-4 font-semibold">{threads.find(t => t.id === selected)?.name ?? "Messages"}</h2>
      {error && <div role="alert" className="mb-3 text-destructive">{error} <Button variant="outline" onClick={refresh}>Retry</Button></div>}
      <div ref={feed} className="flex h-[50vh] flex-col gap-3 overflow-y-auto" aria-live="polite">
        {selected && more && messages.length > 0 && <Button variant="ghost" onClick={older}>Load earlier messages</Button>}
        {selected && !messages.length && <p className="text-sm text-muted-foreground">Start a conversation with your patient.</p>}
        {(selected ? messages : []).map(m => <article key={m.id} className={`rounded-2xl ${m.records.length ? "w-full max-w-[94%] sm:max-w-lg " + (m.sender === "provider" ? "self-end" : "self-start") : "max-w-[90%] p-3 sm:max-w-[75%] " + (m.sender === "provider" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted")}`}>
          {m.records.map(r => <SharedRecordCard key={`${r.type}-${r.id}`} record={r} />)}
          <p className="whitespace-pre-wrap break-words">{m.content}</p>{m.records.length === 0 && <time className="mt-1 block text-right text-xs opacity-75">{new Date(m.created_at).toLocaleString()}</time>}
        </article>)}
      </div>
      <form className="mt-4 flex items-end gap-2" onSubmit={e => { e.preventDefault(); void send() }}><textarea aria-label="Message" placeholder="Write a message…" maxLength={5000} disabled={!selected || sending} value={draft} onChange={e => setDraft(e.target.value)} className="min-h-12 min-w-0 flex-1 rounded-xl border bg-background p-3" /><Button type="submit" disabled={!selected || sending || !draft.trim()}>{sending ? "Sending…" : error ? "Retry send" : "Send"}</Button></form>
    </section>
  </div>
}
