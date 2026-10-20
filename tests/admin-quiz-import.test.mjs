import assert from 'node:assert/strict'
import test from 'node:test'
import { validateQuizImport } from '../lib/admin-quiz-import.mjs'

const fixture = () => ({ title: 'Wellbeing', slug: 'wellbeing', type: 'wellness', estimated_minutes: 2, disclaimer: 'Reflection only.', scoring_rules: { timeframe: 'Today', bands: [{ max: 1, label: 'Reflection' }] }, questions: [{ question: 'Support today?', options: [{ id: 'untrusted', label: 'Some', score: 0 }, { label: 'More', score: 1 }] }] })

test('valid imports normalize nullable descriptions and discard imported identifiers without mutating input', () => {
  const input = fixture(), before = structuredClone(input)
  const result = validateQuizImport(input)
  assert.equal(result.description, '')
  assert.equal(result.questions[0].options[0].id, undefined)
  assert.deepEqual(input, before)
})

test('malformed structures never reach the editor', () => {
  for (const mutate of [v => { v.scoring_rules.bands = [null] }, v => { v.questions = [null] }, v => { v.questions[0].options = [null, null] }, v => { v.scoring_rules = [] }, v => { v.title = {} }, v => { v.description = [] }, v => { v.scoring_rules.bands[0].recommendation = {} }]) {
    const input = fixture(); mutate(input)
    assert.throws(() => validateQuizImport(input))
  }
  for (const input of [null, [], 'quiz']) assert.throws(() => validateQuizImport(input))
})

test('scores, band coverage, ordering, and assessment lengths match server constraints', () => {
  for (const score of [-1, 101, .5, NaN, Infinity, '1']) {
    const input = fixture(); input.questions[0].options[0].score = score
    assert.throws(() => validateQuizImport(input))
  }
  const input = fixture()
  input.scoring_rules.bands[0].max = 0
  assert.throws(() => validateQuizImport(input), /maximum possible score/)
  input.scoring_rules.bands = [{ max: 1, label: 'First' }, { max: 1, label: 'Second' }]
  assert.throws(() => validateQuizImport(input), /increase/)
  input.scoring_rules.bands.pop(); input.slug = 'phq-9'
  assert.throws(() => validateQuizImport(input), /9 questions/)
})

test('blank metadata and oversized collections are rejected', () => {
  for (const key of ['title', 'slug', 'type', 'disclaimer']) {
    const input = fixture(); input[key] = ' '
    assert.throws(() => validateQuizImport(input))
  }
  const input = fixture(); input.questions = Array(101).fill(input.questions[0])
  assert.throws(() => validateQuizImport(input), /1 to 100/)
})
