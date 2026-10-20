export function pendingConsents(config, records) {
  return Object.entries(config.documents).filter(([type, doc]) => type !== 'marketing' && type !== 'ai_disclosure' && !records.some(record => record.document_type === type && record.version === doc.version && (record.status === 'accepted' || (!doc.published && record.status === 'pre_acceptance'))))
}
export function blockingConsent(config, type, doc) {
  return config.enforce_blocking === true && type !== 'marketing' && doc.required === true && doc.published === true && !doc.version.startsWith('draft-') && typeof doc.content === 'string' && doc.content.trim().length > 0
}
