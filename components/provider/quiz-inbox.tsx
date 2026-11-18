"use client"

import { useEffect, useState } from "react"
import { Page, QuizShare, SharedQuizResult } from "@/lib/provider-api"
import { FileCheck2, RefreshCw } from "lucide-react"
import { WorkspaceSection, WorkspaceNote } from "@/components/workspace/workspace-section"
import { Button } from "@/components/ui/button"
import { Empty, Failure, Loading, useData, date } from "./data-list"

export function QuizInbox() {
  const [page, setPage] = useState(1)
  const inbox = useData<Page<QuizShare>>(`quiz-shares?page=${page}`)
  const [selected, setSelected] = useState<number | null>(null)
  const reload = inbox.reload
  useEffect(() => {
    const refresh = () => { reload(); setSelected(null) }
    const hide = () => { if (document.hidden) setSelected(null) }
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", hide)
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", hide) }
  }, [reload])
  return <div className="workspace-results-grid">
    <WorkspaceSection title="Results inbox" description="Only assessments explicitly shared by a patient appear here." actions={<Button aria-label="Refresh shared results" title="Refresh shared results" variant="outline" size="icon" onClick={() => { setSelected(null); inbox.reload() }}><RefreshCw size={16} aria-hidden="true" /></Button>}>
      {inbox.loading ? <Loading /> : inbox.error ? <Failure error={inbox.error} retry={inbox.reload} /> : !inbox.data?.data.length ? <Empty>No results have been shared with you yet.</Empty> : <div className="space-y-3">{inbox.data.data.map(share => <article key={share.id} className={`workspace-result-item ${selected === share.id ? "is-selected" : ""}`}>
        <div className="flex items-start gap-3"><span className="workspace-stat-icon"><FileCheck2 size={18} aria-hidden="true" /></span><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{share.quiz_title}</h3><p className="mt-1 text-xs text-muted-foreground">Shared by {share.sender}</p></div><span className="ml-auto text-xs font-medium text-primary">{share.read_at ? "Read" : "New"}</span></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><time className="text-xs text-muted-foreground">{date(share.completed_at)}</time><Button variant={selected === share.id ? "default" : "outline"} aria-pressed={selected === share.id} onClick={() => setSelected(share.id)}>View result</Button></div>
      </article>)}</div>}
      {inbox.data && inbox.data.last_page > 1 && <div className="workspace-pagination"><Button variant="outline" disabled={page <= 1} onClick={() => { setSelected(null); setPage(page - 1) }}>Previous</Button><span>Page {page} of {inbox.data.last_page}</span><Button variant="outline" disabled={page >= inbox.data.last_page} onClick={() => { setSelected(null); setPage(page + 1) }}>Next</Button></div>}
    </WorkspaceSection>
    <div className="min-w-0 space-y-5">{selected !== null ? <QuizShareDetail key={selected} id={selected} /> : <div className="workspace-panel workspace-empty"><span className="workspace-empty-symbol"><FileCheck2 size={28} aria-hidden="true" /></span><h3>Select a shared assessment</h3><p>Choose View result to see its score, interpretation and guidance here.</p></div>}<WorkspaceNote title="A starting point for conversation">Assessment results support professional judgement. They are not a diagnosis or a substitute for care.</WorkspaceNote></div>
  </div>
}

function QuizShareDetail({ id }: { id: number }) {
  const { data: result, error, loading, reload } = useData<SharedQuizResult>(`quiz-shares/${id}`)
  if (loading) return <Loading />
  if (error) return <Failure error={error} retry={reload} />
  if (!result) return null
  return <WorkspaceSection title={result.quiz_title} description={`Completed ${date(result.completed_at)}`}>
    <div className="workspace-score"><span className="text-xs font-medium text-muted-foreground">Assessment score</span><p aria-label={`Score: ${result.score} / ${result.maximum_score}`} className="mt-3 text-4xl font-semibold tracking-tight">{result.score}<span className="ml-2 text-lg font-normal text-muted-foreground">/ {result.maximum_score}</span></p></div>
    <div className="mt-6 space-y-6"><div><h3 className="text-sm font-semibold">Interpretation</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.interpretation}</p></div><div><h3 className="text-sm font-semibold">Recommended next steps</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{result.recommendation}</p></div><p className="border-t pt-5 text-xs leading-relaxed text-muted-foreground">{result.disclaimer} Not a substitute for professional care. This is not a diagnosis.</p></div>
  </WorkspaceSection>
}
