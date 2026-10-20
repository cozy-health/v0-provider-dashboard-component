import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const source = readFileSync(new URL('../components/provider/shared-record-card.tsx', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const compiled = { exports: {} }
new Function('require', 'module', 'exports', code)(require, compiled, compiled.exports)
const render = record => renderToStaticMarkup(React.createElement(compiled.exports.SharedRecordCard, { record: { id: 'record-1', owner: { name: 'Taylor', initials: 'T' }, ...record } }))

test('record cards show a readable summary and owner without raw dates or internal fields', () => {
  for (const [type, data, title] of [
    ['moods', { mood: 'calm', intensity: 3, note: 'A little room to breathe.' }, 'Feeling calm'],
    ['journals', { title: 'My day', type: 'text', word_count: 146, body: 'PRIVATE JOURNAL TEXT' }, 'My day'],
    ['quizzes', { quiz_title: 'Wellbeing check-in', score: 12, maximum_score: 25, interpretation: 'Saved result' }, 'Wellbeing check-in'],
    ['notes', { body: 'Time for rest.' }, 'A note for your care'],
  ]) {
    const html = render({ type, data: { ...data, created_at: '2026-10-17T12:00:00Z', completed_at: '2026-10-17T12:00:00Z', unknown_private: 'INTERNAL FIELD' } })
    assert.ok(html.includes(title))
    assert.ok(html.includes('Shared by Taylor'))
    assert.ok(html.includes('Cozy Health'))
    for (const hidden of ['2026-10-17', 'created_at', 'completed_at', 'unknown_private', 'INTERNAL FIELD', 'PRIVATE JOURNAL TEXT']) assert.ok(!html.includes(hidden), hidden)
  }
})

test('unavailable cards never render former content, and legacy records have a safe identity fallback', () => {
  const html = render({ type: 'notes', unavailable: true, data: { body: 'REVOKED NOTE' } })
  assert.ok(html.includes('Record unavailable'))
  assert.ok(!html.includes('REVOKED NOTE'))
  assert.ok(render({ type: 'moods', owner: undefined, data: {} }).includes('Shared by patient'))
})

test('long notes offer an accessible expansion control and user content is escaped', () => {
  const html = render({ type: 'notes', data: { body: 'Take a breath. '.repeat(30) + '<script>unsafe()</script>' } })
  assert.ok(html.includes('Read more'))
  assert.ok(html.includes('aria-expanded="false"'))
  assert.ok(!html.includes('<script>'))
})
