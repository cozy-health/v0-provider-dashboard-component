"use client"

import { useState, useSyncExternalStore } from "react"
import Image from "next/image"
import { api, freshNavigation } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const subscribe = () => () => {}
export function LoginForm() {
  const ready = useSyncExternalStore(subscribe, () => true, () => false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login")
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError("")
    const form = new FormData(event.currentTarget)
    try {
      await api(`auth/${mode === "login" ? "login" : mode === "forgot" ? "forgot-password" : "reset-password"}`, { method: "POST", body: JSON.stringify(Object.fromEntries(form)) })
      if (mode === "login") freshNavigation("/")
      else if (mode === "forgot") setMode("reset")
      else { setMode("login"); setError("Password reset. Sign in with your new password.") }
    } catch (err) { setError(err instanceof Error ? err.message : "Could not sign in.") }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen grid place-items-center bg-muted/30 p-6">
    <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
      <Image src="/images/cozy-logo.png" alt="Cozy Health" width={56} height={56} className="mb-6 rounded-xl" />
      <h1 className="text-2xl font-semibold">{mode === "login" ? "Provider sign in" : mode === "forgot" ? "Reset your password" : "Enter your reset code"}</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">{mode === "login" ? "Access the information your patients choose to share." : "Use the email address registered to your provider account."}</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">Email<Input name="email" type="email" autoComplete="username" required maxLength={190} className="mt-2" /></label>
        {mode === "reset" && <label className="block text-sm">Six-digit code<Input name="token" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required /></label>}
        {mode !== "forgot" && <label className="block text-sm">Password<Input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "reset" ? 8 : undefined} maxLength={255} className="mt-2" /></label>}
        {mode === "reset" && <label className="block text-sm">Confirm password<Input name="password_confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={255} /></label>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy || !ready} className="w-full">{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset code" : "Reset password"}</Button>
      </form>
      <Button variant="link" disabled={busy || !ready} onClick={() => { setMode(mode === "login" ? "forgot" : "login"); setError("") }} className="mt-4 px-0">{mode === "login" ? "Forgot password?" : "Back to sign in"}</Button>
      <p className="mt-6 text-xs text-muted-foreground">For patient privacy, sessions end after 30 minutes.</p>
    </section>
  </main>
}
