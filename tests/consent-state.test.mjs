import test from 'node:test'
import assert from 'node:assert/strict'
import { pendingConsents, blockingConsent } from '../lib/consent-state.mjs'

const draft = { title: 'Privacy Policy', version: 'draft-0.1', required: true, published: false, content: null }
test('draft tracking suppresses repeat notices without treating it as published acceptance', () => {
  const records = [{ document_type: 'privacy_policy', version: 'draft-0.1', status: 'pre_acceptance' }]
  assert.deepEqual(pendingConsents({ documents: { privacy_policy: draft } }, records), [])
  assert.equal(pendingConsents({ documents: { privacy_policy: { ...draft, version: 'draft-0.2' } } }, records).length, 1)
  assert.equal(blockingConsent({ enforce_blocking: true }, 'privacy_policy', draft), false)
})
test('blocking requires real published content and never includes marketing', () => {
  const published = { ...draft, version: '1.0', published: true, content: 'Approved fixture text.' }
  assert.equal(blockingConsent({ enforce_blocking: true }, 'privacy_policy', published), true)
  assert.equal(blockingConsent({ enforce_blocking: false }, 'privacy_policy', published), false)
  assert.equal(blockingConsent({ enforce_blocking: true }, 'marketing', published), false)
  assert.deepEqual(pendingConsents({ documents: { marketing: published } }, []), [])
})
