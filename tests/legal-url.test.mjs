import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../lib/legal-url.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const context = { exports: {}, URL }
vm.runInNewContext(compiled, context)
const { legalUrl } = context.exports

test('legal links accept the two first-party websites and reject unsafe destinations', () => {
  for (const host of ['cozyhealth.org', 'dev.cozyhealth.org']) {
    const url = `https://${host}/legal/provider-tos/1.2`
    assert.equal(legalUrl(url), url)
  }
  for (const value of [undefined, 'javascript:alert(1)', 'http://dev.cozyhealth.org/privacy', 'https://foreign.example/privacy', 'https://cozyhealth.org.evil.example/privacy', 'https://user:pass@dev.cozyhealth.org/privacy', 'https://dev.cozyhealth.org:444/privacy']) {
    assert.equal(legalUrl(value), undefined)
  }
})
