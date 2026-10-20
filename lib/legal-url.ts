export function legalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'cozyhealth.org' && !url.port && !url.username && !url.password ? url.href : undefined } catch { return undefined }
}
