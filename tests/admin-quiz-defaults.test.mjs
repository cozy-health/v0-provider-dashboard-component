import assert from 'node:assert/strict'
import test from 'node:test'
import {applyQuizDefaults, withQuizQuestions, cozyUsageRights} from '../lib/admin-quiz-defaults.mjs'
import {validateQuizImport} from '../lib/admin-quiz-import.mjs'

test('new Cozy drafts need only their title, key and question wording before saving', () => {
 const value = applyQuizDefaults()
 value.title = 'New Cozy check-in'; value.slug = 'new-cozy-check-in'; value.questions[0].question = 'How have you felt?'
 const saved = validateQuizImport(value)
 assert.match(saved.disclaimer, /not a diagnosis/)
 assert.equal(saved.scoring_rules.timeframe, 'Over the past two weeks')
 assert.equal(saved.scoring_rules.provenance.license, cozyUsageRights)
 assert.ok(saved.scoring_rules.provenance.approval_reference)
 assert.deepEqual(saved.scoring_rules.bands.map(b => [b.max,b.label]), [[3,'Personal reflection']])
 assert.equal(saved.scoring_rules.crisis_threshold, undefined)
 assert.doesNotMatch(JSON.stringify(saved), /approved by|Cordelia|2026-11-05/i)
})

test('older three-question draft receives complete proposed bands without changing questions or ownership edits', () => {
 const value = {title:'Wellbeing Check',slug:'wellbeing-check',type:'wellbeing',estimated_minutes:3,disclaimer:'',questions:Array.from({length:3}, (_,i) => ({question:`Question ${i}`, options:[0,1,2,3].map(score=>({label:String(score),score}))})), scoring_rules:{timeframe:'',provenance:{license:'Owner confirmed rights',approval_reference:'Owner review'},bands:[{max:1,label:'',recommendation:''}]}}
 const before = structuredClone(value)
 const result = validateQuizImport(applyQuizDefaults(value))
 assert.deepEqual(result.scoring_rules.bands.map(b=>b.max),[3,6,9])
 assert.equal(result.scoring_rules.provenance.license,'Owner confirmed rights')
 assert.equal(result.scoring_rules.provenance.approval_reference,'Owner review')
 assert.deepEqual(result.questions,value.questions)
 assert.deepEqual(value,before)
})

test('custom disclaimer, timeframe, bands and external attribution survive defaults and question edits', () => {
 const value=applyQuizDefaults(); value.disclaimer='Custom disclaimer'; value.scoring_rules.timeframe='Today'
 value.scoring_rules.bands=[{max:9,label:'Custom',recommendation:'Custom advice'}]
 value.scoring_rules.provenance={source_url:'https://example.test/source',license:'External licence',approval_reference:'Specific review'}
 const result=applyQuizDefaults(value)
 assert.deepEqual(result,value)
 assert.deepEqual(withQuizQuestions(result,[...result.questions,...result.questions]).scoring_rules.bands,value.scoring_rules.bands)
 const sourced=applyQuizDefaults({...value,scoring_rules:{...value.scoring_rules,provenance:{source_url:'https://example.test/source'}}})
 assert.equal(sourced.scoring_rules.provenance.license,'')
})

test('generic reflection score coverage follows question and option changes, while drafts remain independent', () => {
 const a=applyQuizDefaults(), b=applyQuizDefaults()
 a.questions[0].question='Changed'; assert.equal(b.questions[0].question,'')
 const changed=withQuizQuestions(a,[...a.questions,{question:'Second',options:[{label:'A',score:1},{label:'B',score:5}]}])
 assert.equal(changed.scoring_rules.bands[0].max,8)
 assert.equal(a.scoring_rules.bands[0].max,3)
})
