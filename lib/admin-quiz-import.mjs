// Validate before touching editor state. The API remains authoritative on save.
export function validateQuizImport(value) {
  const object = (v, label) => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${label} must be an object.`) }
  const text = (v, label, max, optional = false) => {
    if (optional && v == null) return
    if (typeof v !== 'string' || (!optional && !v.trim()) || [...v].length > max) throw new Error(`${label} must be ${optional ? 'text' : 'nonblank text'} of at most ${max} characters.`)
  }
  const integer = (v, label, min, max) => { if (!Number.isInteger(v) || v < min || v > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`) }
  const array = (v, label, min, max) => { if (!Array.isArray(v) || v.length < min || v.length > max) throw new Error(`${label} must contain ${min} to ${max} entries.`) }
  object(value, 'Assessment')
  text(value.title, 'Title', 100); text(value.slug, 'Stable key', 100)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) throw new Error('Stable key must use lowercase letters, numbers, and single hyphens.')
  text(value.type, 'Type', 50); text(value.description, 'Description', 5000, true)
  text(value.disclaimer, 'Disclaimer', 5000)
  integer(value.estimated_minutes, 'Estimated minutes', 1, 120)
  if (value.sort_order !== undefined) integer(value.sort_order, 'Order', 0, 10000)
  object(value.scoring_rules, 'Scoring rules')
  const rules = value.scoring_rules
  text(rules.timeframe, 'Timeframe', 200)
  text(rules.recommendation, 'Recommendation', 2000, true)
  if (rules.crisis_threshold !== undefined) integer(rules.crisis_threshold, 'Crisis threshold', 0, 10000)
  array(value.questions, 'Questions', 1, 100)
  const expected = { 'phq-9': 9, 'gad-7': 7, 'pss-10': 10, sleep: 8 }[value.slug]
  if (expected && value.questions.length !== expected) throw new Error(`This assessment requires ${expected} questions.`)
  let maximum = 0
  value.questions.forEach((question, i) => {
    object(question, `Question ${i + 1}`); text(question.question, `Question ${i + 1}`, 2000)
    array(question.options, `Question ${i + 1} options`, 2, 10)
    question.options.forEach((option, j) => { object(option, `Option ${j + 1}`); text(option.label, `Option ${j + 1} label`, 500); integer(option.score, `Option ${j + 1} score`, 0, 100) })
    maximum += Math.max(...question.options.map(option => option.score))
  })
  array(rules.bands, 'Scoring bands', 1, 50)
  let previous = -1
  rules.bands.forEach((band, i) => {
    object(band, `Scoring band ${i + 1}`); integer(band.max, `Scoring band ${i + 1} maximum`, 0, 10000)
    text(band.label, `Scoring band ${i + 1} label`, 50); text(band.recommendation, `Scoring band ${i + 1} recommendation`, 2000, true)
    if (band.max <= previous) throw new Error('Scoring band maximums must increase in order.')
    previous = band.max
  })
  if (previous < maximum) throw new Error(`Scoring bands must cover the maximum possible score (${maximum}).`)
  // Keep only editor-supported metadata, and discard imported option IDs.
  return { title: value.title, slug: value.slug, type: value.type, description: value.description ?? '', estimated_minutes: value.estimated_minutes, disclaimer: value.disclaimer,
    ...(value.sort_order !== undefined ? { sort_order: value.sort_order } : {}),
    scoring_rules: { timeframe: rules.timeframe, bands: rules.bands.map(b => ({ max: b.max, label: b.label, ...(b.recommendation != null ? { recommendation: b.recommendation } : {}) })),
      ...(rules.recommendation != null ? { recommendation: rules.recommendation } : {}), ...(rules.crisis_threshold !== undefined ? { crisis_threshold: rules.crisis_threshold } : {}) },
    questions: value.questions.map(q => ({ question: q.question, options: q.options.map(o => ({ label: o.label, score: o.score })) })) }
}
