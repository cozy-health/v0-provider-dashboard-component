import assert from 'node:assert/strict'
import { test } from 'node:test'
import { refreshingLoadState, visibleLoadState } from '../lib/provider-load-state.ts'

test('same-resource refresh keeps usable content without replacing it with initial loading', () => {
  const data = [{ user_id: 10, name: 'Synthetic patient' }]
  const loaded = { path: 'clients', data, loading: false, refreshing: false }
  const refreshing = refreshingLoadState(loaded, 'clients')
  assert.equal(refreshing.data, data)
  assert.equal(refreshing.loading, false)
  assert.equal(refreshing.refreshing, true)
  assert.equal(loaded.refreshing, false)
})

test('changing patient or filter hides the prior resource immediately', () => {
  const previous = { path: 'clients/10', data: { user_id: 10 }, loading: false, refreshing: false }
  for (const path of ['clients/11', 'clients/10/insights?period=month', 'clients/10?consent=changed']) {
    const visible = visibleLoadState(previous, path)
    assert.equal(visible.path, path)
    assert.equal(visible.data, undefined)
    assert.equal(visible.loading, true)
    assert.equal(refreshingLoadState(previous, path).data, undefined)
  }
})

test('empty results remain a usable view while refreshing', () => {
  const state = refreshingLoadState({ path: 'clients', data: [], loading: false, refreshing: false }, 'clients')
  assert.deepEqual(state.data, [])
  assert.equal(state.loading, false)
})

test('failed initial requests retry with loading and clear the obsolete error', () => {
  const state = refreshingLoadState({ path: 'clients', error: 'Unavailable', loading: false, refreshing: false }, 'clients')
  assert.equal(state.loading, true)
  assert.equal(state.error, undefined)
  assert.equal(state.data, undefined)
})

test('an error state does not restore previously shared patient data', () => {
  const failed = { path: 'clients/10', error: 'Sharing revoked', loading: false, refreshing: false }
  assert.equal(visibleLoadState(failed, 'clients/10').data, undefined)
  assert.equal(visibleLoadState(failed, 'clients/10').error, 'Sharing revoked')
})
