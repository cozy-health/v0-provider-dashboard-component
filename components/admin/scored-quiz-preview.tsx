"use client"

import { useEffect, useRef, useState } from "react"
import { adminApi } from "@/lib/admin-api"
import { Button } from "@/components/ui/button"
import type { Definition } from "./quiz-editor"

type Result = { score: number; maximum_score: number; interpretation: string; recommendation: string; disclaimer: string; is_crisis_flagged: boolean }

export function ScoredQuizPreview({ definition, readOnly }: { definition: Definition; readOnly: boolean }) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])

  function select(question: number, option: number) {
    active.current?.abort()
    setBusy(false)
    setResult(null)
    setError("")
    setAnswers(previous => ({ ...previous, [question]: option }))
  }

  async function calculate() {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setError("")
    setResult(null)
    try {
      const response = await adminApi<{ data: Result }>("quizzes/preview", { method: "POST", signal: controller.signal,
        body: JSON.stringify({ definition, answers: definition.questions.map((_, index) => answers[index]) }) })
      if (!controller.signal.aborted) setResult(response.data)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Preview could not be calculated. Try again.")
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
    <p className="text-sm text-muted-foreground">Preview only. Answers and results are not saved as patient records.</p>
    {definition.questions.map((question, index) => <fieldset key={index} className="min-w-0 rounded-lg border p-2 sm:p-4" disabled={readOnly}>
      <legend>{index + 1}. {question.question}</legend>
      {question.options.map((option, optionIndex) => <label key={optionIndex} className="flex min-h-11 items-center gap-3 py-2">
        <input type="radio" name={`preview-${index}`} checked={answers[index] === optionIndex} onChange={() => select(index, optionIndex)} />
        <span className="min-w-0">{option.label}{readOnly ? ` (score: ${option.score})` : ""}</span>
      </label>)}
    </fieldset>)}
    {!readOnly && <Button className="h-auto min-h-9 min-w-0 max-w-full whitespace-normal" onClick={calculate} disabled={busy || Object.keys(answers).length !== definition.questions.length}>{busy ? "Calculating..." : "Calculate preview result"}</Button>}
    {error && <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}
    {result && <div role="status" className="space-y-2 rounded-lg border p-2 sm:p-4">
      <h4 className="font-semibold">Preview result: {result.interpretation}</h4>
      <p>Score: {result.score} / {result.maximum_score}</p>
      {result.recommendation && <p>{result.recommendation}</p>}
      <p>{result.disclaimer}</p>
      <p>Safety flag: {result.is_crisis_flagged ? "Yes" : "No"}</p>
    </div>}
  </div>
}
