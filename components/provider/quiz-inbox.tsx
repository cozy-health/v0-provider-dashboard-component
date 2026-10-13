"use client"

import { useEffect, useState } from "react"
import { Page, QuizShare, SharedQuizResult } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Card, Empty, Failure, Loading, useData, date } from "./data-list"

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
  return <div className="space-y-5">
    <Button variant="outline" onClick={() => { setSelected(null); inbox.reload() }}>Refresh shared results</Button>
    {inbox.loading ? <Loading /> : inbox.error ? <Failure error={inbox.error} retry={inbox.reload} /> : !inbox.data?.data.length ? <Empty>No results have been shared with you yet.</Empty> : inbox.data.data.map(share => <Card key={share.id}>
      <h2 className="font-semibold">{share.sender} shared {share.quiz_title}</h2><p>{date(share.completed_at)} {share.read_at ? "· Read" : "· New"}</p>
      <Button onClick={() => setSelected(share.id)}>View result</Button>
    </Card>)}
    {inbox.data && <div className="flex gap-3"><Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page} of {inbox.data.last_page}</span><Button disabled={page >= inbox.data.last_page} onClick={() => setPage(page + 1)}>Next</Button></div>}
    {selected !== null && <QuizShareDetail key={selected} id={selected} />}
  </div>
}

function QuizShareDetail({ id }: { id: number }) {
  const { data: result, error, loading, reload } = useData<SharedQuizResult>(`quiz-shares/${id}`)
  if (loading) return <Loading />
  if (error) return <Failure error={error} retry={reload} />
  if (!result) return null
  return <Card><h2 className="text-xl font-semibold">{result.quiz_title}</h2><p>Score: {result.score} / {result.maximum_score}</p><p>{result.interpretation}</p><p>{date(result.completed_at)}</p><p>{result.recommendation}</p><p>{result.disclaimer}</p><p>Not a substitute for professional care. This is not a diagnosis.</p></Card>
}
