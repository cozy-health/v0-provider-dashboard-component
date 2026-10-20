let pending: Promise<Record<string, string>> | null = null

export async function mutationHeaders(method = "GET"): Promise<Record<string, string>> {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return {}
  if (!pending) pending = fetch("/api/csrf", { credentials: "same-origin", cache: "no-store" }).then(async response => {
    if (!response.ok) throw new Error("Could not secure this request. Please retry.")
    const data = await response.json()
    if (typeof data.token !== "string" || !/^[a-f0-9]{64}$/.test(data.token)) throw new Error("Invalid request token.")
    return { "X-CSRF-Token": data.token }
  }).finally(() => { pending = null })
  return pending
}
