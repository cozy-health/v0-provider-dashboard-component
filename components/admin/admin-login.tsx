"use client"

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { LoaderCircle } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/auth/password-input"
import { AuthCard } from "@/components/auth/auth-card"

const subscribe = () => () => {}
export function AdminLogin() {
  const ready = useSyncExternalStore(subscribe, () => true, () => false)
  const expired = ready && new URLSearchParams(window.location.search).has("expired")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    const email = String(fields.get("email") || "").trim().toLowerCase()
    setBusy(true); setError(null)
    try {
      await adminApi("auth/login", { method: "POST", body: JSON.stringify({ email, password: fields.get("password") }) })
      window.location.replace("/admin")
    } catch (err) { setError((err as Error).message); setBusy(false) }
  }
  return <AuthCard title="Admin sign in" audience="Operations" description="Sign in to review aggregate usage and safety metrics. Individual patient information stays private.">
    {expired && <p role="status" className="mb-5 rounded-lg bg-muted p-3 text-sm">Your session ended. Sign in again to continue.</p>}
    <form onSubmit={submit} aria-busy={busy} className="space-y-5">
      <fieldset disabled={busy} className="space-y-5">
        <div className="space-y-2"><label htmlFor="admin-email" className="block text-sm font-medium">Email</label><Input id="admin-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={190} className="h-11" /></div>
        <PasswordInput label="Password" name="password" autoComplete="current-password" required maxLength={255} />
      </fieldset>
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={busy || !ready}>{busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
    <p className="mt-5 text-center text-sm text-muted-foreground">Forgot your password?{" "}<Link href="/admin/reset-password" className="font-medium text-primary underline underline-offset-4">Reset it here</Link></p>
    <p className="mt-6 text-center text-sm text-muted-foreground">Are you a provider?{" "}<Link href="/login" className="font-medium text-primary underline underline-offset-4">Provider sign in</Link></p>
  </AuthCard>
}
