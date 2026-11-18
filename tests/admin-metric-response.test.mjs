import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertMetricResponse } from '../lib/admin-metric-response.ts'

const meta = { release: '2026-11-01', timezone: 'UTC', window: { from: '2026-10-01', to_exclusive: '2026-11-01' } }
test('a paginated fallback cannot be rendered as a published safety report', () => {
  const fallback = { data: { data: [], current_page: 1, last_page: 1, total: 0 } }
  // This reproduces the old Safety render path's undefined meta access.
  assert.throws(() => fallback.meta.release, TypeError)
  assert.throws(() => assertMetricResponse(fallback, 'safety'), /published report is incomplete/)
})
test('unavailable and privacy-suppressed safety values remain valid, distinct from zero', () => {
  assert.doesNotThrow(() => assertMetricResponse({ meta, data: [{ range: '7d', status: 'suppressed', count: '<5' }, { range: '30d', status: 'unavailable', count: null }, { range: '90d', status: 'available', count: 0 }] }, 'safety'))
})
test('malformed report collections fail before chart render; empty published collections are valid', () => {
  assert.throws(() => assertMetricResponse({ meta, data: {} }, 'retention'), /incomplete/)
  assert.throws(() => assertMetricResponse({ meta, data: [] }, 'usage'), /incomplete/)
  assert.doesNotThrow(() => assertMetricResponse({ meta, data: [] }, 'retention'))
  assert.doesNotThrow(() => assertMetricResponse({ meta, data: { features: [] } }, 'usage'))
})
