"use client"

import { useEffect, useState } from "react"
import { BookOpen, ChevronLeft, ChevronRight, Eye, Plus, RefreshCw, Save, Send } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Draft = { title: string; slug: string; category: string; excerpt: string; body: string; read_time_minutes: number; license: string | null; source_url: string | null }
type Article = { id: string; version: string; published: boolean; has_draft: boolean; draft: Draft }
type ArticlePage = { data: Article[]; current_page: number; last_page: number; total: number }
const blank: Draft = { title: "", slug: "", category: "self-care", excerpt: "", body: "", read_time_minutes: 3, license: null, source_url: null }
const categories = ["anxiety", "depression", "sleep", "relationships", "self-care", "work"]
const inputClass = "w-full rounded-lg border bg-background px-3 py-2.5 text-sm"

export function ArticleEditor() {
  const [records, setRecords] = useState<Article[]>([])
  const [current, setCurrent] = useState<Article | null>(null)
  const [draft, setDraft] = useState<Draft>({ ...blank })
  const [page, setPage] = useState(1), [lastPage, setLastPage] = useState(1)
  const [search, setSearch] = useState(""), [query, setQuery] = useState("")
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(""), [notice, setNotice] = useState("")
  const [preview, setPreview] = useState(false), [approved, setApproved] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(current?.draft ?? blank)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    adminApi<{ data: ArticlePage }>(`articles?page=${page}&per_page=10${query ? `&search=${encodeURIComponent(query)}` : ""}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setRecords(result.data.data); setLastPage(result.data.last_page); setError("") } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Articles could not be loaded.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, query, revision])

  useEffect(() => {
    if (!dirty) return
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener("beforeunload", preventLoss)
    return () => window.removeEventListener("beforeunload", preventLoss)
  }, [dirty])

  function select(article: Article | null) {
    if (dirty && !window.confirm("Discard your unsaved article changes?")) return
    setCurrent(article); setDraft({ ...(article?.draft ?? blank) }); setApproved(false); setError(""); setNotice("")
  }

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(previous => ({ ...previous, [key]: value })); setApproved(false); setNotice("")
  }

  async function action(kind: "save" | "publish" | "unpublish") {
    if (busy || kind !== "save" && (!current || dirty)) return
    setBusy(true); setError(""); setNotice("")
    try {
      const path = kind === "save" ? current ? `articles/${current.id}` : "articles" : kind === "publish" ? `articles/${current?.id}/publish` : `articles/${current?.id}`
      const body = kind === "save" ? { ...draft, ...(current ? { expected_version: current.version } : {}) } : { expected_version: current?.version, ...(kind === "publish" ? { approved } : {}) }
      const result = await adminApi<{ data: Article }>(path, { method: kind === "save" ? current ? "PUT" : "POST" : kind === "publish" ? "POST" : "DELETE", body: JSON.stringify(body) })
      setCurrent(result.data); setDraft({ ...result.data.draft }); setApproved(false); setRevision(value => value + 1)
      setNotice(kind === "save" ? "Draft saved. The published article has not changed." : kind === "publish" ? "Article published to the app catalogue." : "Article unpublished. Existing bookmarks can still be removed.")
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "The article could not be saved.") }
    finally { setBusy(false) }
  }

  async function reloadCurrent() {
    if (!current || busy || dirty && !window.confirm("Discard your unsaved text and reload the saved article?")) return
    setBusy(true)
    try {
      const result = await adminApi<{ data: Article }>(`articles/${current.id}`)
      setCurrent(result.data); setDraft({ ...result.data.draft }); setApproved(false); setError(""); setNotice("Saved article reloaded.")
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "Could not reload this article.") }
    finally { setBusy(false) }
  }

  return <section className="cozy-admin space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Cozy Library</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Published articles</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Write a draft, preview the reading experience, then approve publication. Draft edits stay separate from the article people can currently read.</p></div>
      <Button disabled={busy} variant="outline" onClick={() => select(null)}><Plus className="size-4" /> New article</Button>
    </header>
    <div className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-4 rounded-xl border bg-card p-5">
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()) }}><input aria-label="Search articles" className={inputClass} maxLength={100} placeholder="Search articles" value={search} onChange={event => setSearch(event.target.value)} /><Button type="submit" variant="outline">Search</Button></form>
        {loading ? <p role="status">Loading articles…</p> : records.length === 0 ? <p className="text-sm text-muted-foreground">No articles match this selection.</p> : <ul className="space-y-2">{records.map(article => <li key={article.id}><button type="button" disabled={busy} aria-current={current?.id === article.id ? "true" : undefined} className={`w-full rounded-lg border p-3 text-left ${current?.id === article.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`} onClick={() => select(article)}><span className="block font-medium">{article.draft.title}</span><span className="mt-1 block text-xs text-muted-foreground">{article.published ? "Published" : "Unpublished"}{article.has_draft ? " · draft changes" : ""}</span></button></li>)}</ul>}
        <div className="flex items-center justify-between gap-2"><Button aria-label="Previous article page" size="icon" variant="outline" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft className="size-4" /></Button><span className="text-xs">Page {page} of {lastPage}</span><Button aria-label="Next article page" size="icon" variant="outline" disabled={loading || page >= lastPage} onClick={() => setPage(value => value + 1)}><ChevronRight className="size-4" /></Button></div>
        <Button variant="ghost" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}><RefreshCw className="size-4" /> Refresh list</Button>
      </aside>
      <form className="space-y-5 rounded-xl border bg-card p-5 sm:p-7" onSubmit={event => { event.preventDefault(); void action("save") }}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="size-5" /> {current ? "Edit article draft" : "New article draft"}</h2><span className="text-xs text-muted-foreground">{dirty ? "Unsaved changes" : current ? "Saved" : "Not saved"}</span></div>
        <fieldset disabled={busy} className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">Title<input required maxLength={255} className={inputClass} value={draft.title} onChange={event => change("title", event.target.value)} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium">Stable article key<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} className={inputClass} value={draft.slug} onChange={event => change("slug", event.target.value)} /><span className="block text-xs font-normal text-muted-foreground">Use lowercase words separated by hyphens. Published keys cannot change.</span></label><label className="block space-y-2 text-sm font-medium">Category<select className={inputClass} value={draft.category} onChange={event => change("category", event.target.value)}>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label></div>
          <label className="block space-y-2 text-sm font-medium">Short introduction<textarea required maxLength={1000} rows={3} className={inputClass} value={draft.excerpt} onChange={event => change("excerpt", event.target.value)} /></label>
          <label className="block space-y-2 text-sm font-medium">Article text<textarea required maxLength={50000} rows={16} className={`${inputClass} leading-relaxed`} value={draft.body} onChange={event => change("body", event.target.value)} /><span className="block text-xs font-normal text-muted-foreground">Plain text, with blank lines between paragraphs. The app displays this text as written.</span></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium">Reading time in minutes<input required type="number" min={1} max={180} step={1} className={inputClass} value={draft.read_time_minutes} onChange={event => change("read_time_minutes", Number(event.target.value))} /></label><label className="block space-y-2 text-sm font-medium">Rights or licence reference<input maxLength={255} className={inputClass} value={draft.license ?? ""} onChange={event => change("license", event.target.value || null)} /><span className="block text-xs font-normal text-muted-foreground">Required before publication.</span></label></div>
          <label className="block space-y-2 text-sm font-medium">Source URL (optional)<input type="url" pattern="https://.*" maxLength={1000} className={inputClass} value={draft.source_url ?? ""} onChange={event => change("source_url", event.target.value || null)} /></label>
        </fieldset>
        {error && <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
        {current && <Button type="button" variant="ghost" disabled={busy} onClick={() => void reloadCurrent()}><RefreshCw className="size-4" /> Reload saved article</Button>}
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy || !dirty && !!current}><Save className="size-4" /> {busy ? "Saving…" : "Save draft"}</Button><Button type="button" variant="outline" disabled={!draft.title || !draft.body || busy} onClick={() => setPreview(true)}><Eye className="size-4" /> Preview</Button></div>
        <div className="space-y-4 border-t pt-5"><label className="flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" className="mt-1" checked={approved} disabled={busy || dirty || !current} onChange={event => setApproved(event.target.checked)} />I have reviewed this saved draft, confirmed the rights to publish it, and approve it for the app.</label><div className="flex flex-wrap gap-3"><Button type="button" disabled={busy || dirty || !current || !approved} onClick={() => void action("publish")}><Send className="size-4" /> Publish approved draft</Button>{current?.published && <Button type="button" variant="outline" disabled={busy || dirty} onClick={() => { if (window.confirm("Unpublish this article from the app catalogue?")) void action("unpublish") }}>Unpublish</Button>}</div>{dirty && <p className="text-xs text-muted-foreground">Save changes before publishing or unpublishing. A conflict keeps your draft on screen so you can review it before reloading.</p>}</div>
      </form>
    </div>
    <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{draft.title}</DialogTitle><DialogDescription>Draft preview · {draft.category} · {draft.read_time_minutes} min read · not published by opening this preview</DialogDescription></DialogHeader><p className="text-lg leading-relaxed text-muted-foreground">{draft.excerpt}</p><article className="whitespace-pre-wrap text-base leading-8">{draft.body}</article></DialogContent></Dialog>
  </section>
}
