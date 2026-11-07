export function legalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try { const url = new URL(value); return url.protocol === 'https:' && ['cozyhealth.org', 'dev.cozyhealth.org'].includes(url.hostname) && !url.port && !url.username && !url.password ? url.href : undefined } catch { return undefined }
}
