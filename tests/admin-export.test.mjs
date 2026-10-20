import assert from 'node:assert/strict'
import test from 'node:test'
import { publishedCsv } from '../lib/admin-export.mjs'
test('published CSV preserves metadata, quoted values and suppression without inventing zeros', () => {
 const csv = publishedCsv({ release:'2026-10-01',from:'2026-09-01',to_exclusive:'2026-10-01',units:'Records' }, ['Category','Records'], [['Mood, "calm"',15],['Hidden','Suppressed (<5)'],['Unknown',null]])
 assert.ok(csv.includes('"release","2026-10-01"'))
 assert.ok(csv.includes('"Mood, ""calm""","15"'))
 assert.ok(csv.includes('"Hidden","Suppressed (<5)"'))
 assert.ok(csv.includes('"Unknown","Not published"'))
})
test('published CSV neutralizes spreadsheet formulas including whitespace prefixes', () => {
 const csv = publishedCsv({}, ['Category','Records'], [['=HYPERLINK("bad")',5],['\t+formula',10],['@formula',15],['-formula',20]])
 for (const prefix of ['\'=HYPERLINK','\'\t+formula','\'@formula','\'-formula']) assert.ok(csv.includes(prefix))
})
