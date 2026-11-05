export const cozyDisclaimer = "This Cozy well-being check-in is for personal reflection. It is not a diagnosis or a validated clinical screening tool. If you are concerned about your well-being, speak with a qualified professional. If you feel unsafe or need urgent help, contact local emergency services or use the app's crisis support resources."
export const cozyUsageRights = "Created by Cozy Health for use in Cozy well-being check-ins."
export const cozyReviewReference = "Cozy Health well-being check-in editorial review"
const reflectionRecommendation = "Use your answers to notice how you have been feeling and what support might help. This score is not a clinical assessment."
const textOr = (value, fallback) => typeof value === 'string' && value.trim() ? value : fallback

/** @param {import('../components/admin/quiz-editor').Definition['questions']} questions */
export function reflectionBands(questions) {
 const maximum = questions.reduce((total, question) => total + Math.max(0, ...question.options.map(option => Number.isInteger(option.score) ? option.score : 0)), 0)
 return [{ max: maximum, label: 'Personal reflection', recommendation: reflectionRecommendation }]
}

/** Fill missing metadata without replacing administrator edits or supplied scoring.
 * @param {Partial<import('../components/admin/quiz-editor').Definition>} [value]
 * @returns {import('../components/admin/quiz-editor').Definition}
 */
export function applyQuizDefaults(value = {}) {
 const questions = value.questions ?? [{ question: '', options: [{ label: 'Never', score: 0 }, { label: 'Sometimes', score: 1 }, { label: 'Often', score: 2 }, { label: 'Nearly always', score: 3 }] }]
 const rules = value.scoring_rules ?? {}
 const provenance = rules.provenance ?? {}
 const existingBands = rules.bands ?? []
 // Legacy empty placeholder bands have no interpretation to preserve.
 const bands = existingBands.length && existingBands.some(band => typeof band.label === 'string' && band.label.trim())
  ? existingBands : value.slug === 'wellbeing-check' && questions.length === 3 && questions.every(q => q.options.map(o => o.score).join(',') === '0,1,2,3')
   ? [
    { max: 3, label: 'More support may help', recommendation: 'Consider speaking with someone you trust or a qualified professional about how you have been feeling.' },
    { max: 6, label: 'Some positive experiences', recommendation: 'Notice what helps you relax, feel hopeful and maintain energy, and make time for those activities.' },
    { max: 9, label: 'Frequent positive experiences', recommendation: 'Continue the habits and connections that support your well-being.' },
   ] : reflectionBands(questions)
 return structuredClone({
  title: '', slug: '', type: 'wellness', description: 'A Cozy well-being check-in for personal reflection.', estimated_minutes: 3,
  ...value, disclaimer: textOr(value.disclaimer, cozyDisclaimer), questions,
  scoring_rules: { ...rules, timeframe: textOr(rules.timeframe, 'Over the past two weeks'), bands,
   provenance: { ...provenance, license: textOr(provenance.license, provenance.source_url ? '' : cozyUsageRights), approval_reference: textOr(provenance.approval_reference, cozyReviewReference) },
  },
 })
}

/** Keep only the generic reflection band in sync as questions/options change.
 * @param {import('../components/admin/quiz-editor').Definition} definition
 * @param {import('../components/admin/quiz-editor').Definition['questions']} questions
 */
export function withQuizQuestions(definition, questions) {
 const bands = definition.scoring_rules.bands
 const generic = bands.length === 1 && bands[0]?.label === 'Personal reflection' && bands[0]?.recommendation === reflectionRecommendation
 return { ...definition, questions, scoring_rules: { ...definition.scoring_rules, bands: generic ? reflectionBands(questions) : bands } }
}
