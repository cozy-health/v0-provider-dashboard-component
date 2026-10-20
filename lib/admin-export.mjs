export function publishedCsv(metadata, columns, rows) {
  const field = value => {
    let text = value == null ? 'Not published' : String(value)
    if (typeof value !== 'number' && /^[\s]*[=+@-]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }
  return [...Object.entries(metadata).map(([key, value]) => [key, value]), [], columns, ...rows].map(row => row.map(field).join(',')).join('\r\n') + '\r\n'
}
