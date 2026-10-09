"use client"
import { useState } from "react"
import { adminApi } from "@/lib/admin-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
export function AdminLogin() {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null)
    try { await adminApi("auth/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); window.location.replace("/admin") }
    catch (err) { setError((err as Error).message); setBusy(false) }
  }
  return <main className="min-h-screen flex items-center justify-center p-6 bg-muted/30"><section className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm"><p className="text-sm text-primary mb-3">Cozy Health · Operations</p><h1 className="text-2xl font-semibold">Admin sign in</h1><p className="text-sm text-muted-foreground mt-3 mb-6">Authorized operators only. Analytics contain aggregate data.</p><form onSubmit={submit} className="space-y-5"><label className="block text-sm">Email<Input name="email" type="email" autoComplete="username" required maxLength={190} className="mt-2" /></label><label className="block text-sm">Password<Input name="password" type="password" autoComplete="current-password" required maxLength={255} className="mt-2" /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button></form><p className="text-xs text-muted-foreground mt-5">Sessions expire after 30 minutes. Contact your account administrator for password reset or access help.</p><a href="/login" className="block text-sm underline mt-4">Provider sign in</a></section></main>
}
