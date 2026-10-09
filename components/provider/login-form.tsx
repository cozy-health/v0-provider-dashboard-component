"use client"

import { useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { api, ApiError, freshNavigation } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/auth/password-input"
import { AuthCard } from "@/components/auth/auth-card"
import { useCooldown } from "@/components/auth/use-cooldown"

const subscribe = () => () => {}
type Mode = "login" | "forgot" | "reset"
export function LoginForm() {
  const ready = useSyncExternalStore(subscribe, () => true, () => false)
  const expired = ready && new URLSearchParams(window.location.search).has("expired")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [mode, setMode] = useState<Mode>("login")
  const emailInput = useRef<HTMLInputElement>(null)
  const resend = useCooldown(), attempts = useCooldown()

  async function perform(action: Mode, fields?: FormData) {
    if (busy) return
    setBusy(true); setError("")
    const normalizedEmail = email.trim().toLowerCase()
    try {
      await api(`auth/${action === "login" ? "login" : action === "forgot" ? "forgot-password" : "reset-password"}`, {
        method: "POST", body: JSON.stringify({ ...(fields ? Object.fromEntries(fields) : {}), email: normalizedEmail }),
      })
      if (action === "login") freshNavigation("/")
      else if (action === "forgot") {
        setEmail(normalizedEmail); setMode("reset"); resend.start(60)
        if (mode === "reset") toast.success("If an account exists, a new reset code is on its way.")
      } else {
        setMode("login")
        toast.success("Password reset. Sign in with your new password.")
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const cooldown = action === "forgot" ? resend : attempts
        cooldown.start(err.retryAfter || 60)
      }
      setError(err instanceof TypeError ? "Could not connect. Check your connection and try again." : err instanceof Error ? err.message : "Please retry later.")
    } finally { setBusy(false) }
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    if (mode === "reset" && fields.get("password") !== fields.get("password_confirmation")) { setError("Passwords must match."); return }
    void perform(mode, fields)
  }
  const waiting = mode === "forgot" ? resend.remaining : attempts.remaining
  return <AuthCard audience="Provider portal" title={mode === "login" ? "Provider sign in" : mode === "forgot" ? "Reset your password" : "Enter your reset code"}
    description={mode === "login" ? "Access the information your patients choose to share." : mode === "forgot" ? "We’ll email a six-digit code to your registered provider address." : "Use the latest code from your email. It expires after 15 minutes."}>
    {expired && mode === "login" && <p role="status" className="mb-5 rounded-lg bg-muted p-3 text-sm">Your session ended. Sign in again to continue.</p>}
    {mode !== "login" && <p className="mb-5 text-xs font-medium text-muted-foreground">Step {mode === "forgot" ? "1" : "2"} of 2</p>}
    {mode === "reset" && <p role="status" className="mb-5 rounded-lg bg-muted p-3 text-sm">If an account exists with that email, you&apos;ll receive a reset code. Check your inbox and spam folder.</p>}
    <form key={mode} onSubmit={submit} aria-busy={busy} className="space-y-5">
      <fieldset disabled={busy} className="space-y-5">
        <div className="space-y-2"><label htmlFor="provider-email" className="block text-sm font-medium">Email</label><Input ref={emailInput} id="provider-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={190} value={email} onChange={event => setEmail(event.target.value)} readOnly={mode === "reset"} className="h-11" /></div>
        {mode === "reset" && <div className="space-y-2"><label htmlFor="provider-code" className="block text-sm font-medium">Six-digit code</label><Input id="provider-code" name="token" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" autoFocus required className="h-11 text-center text-lg tracking-[0.3em]" /></div>}
        {mode !== "forgot" && <PasswordInput key={mode} label={mode === "login" ? "Password" : "New password"} name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "reset" ? 8 : undefined} maxLength={255} hint={mode === "reset" ? "Use at least 8 characters and a password you don’t use elsewhere." : undefined} />}
        {mode === "reset" && <PasswordInput label="Confirm password" name="password_confirmation" autoComplete="new-password" required minLength={8} maxLength={255} />}
      </fieldset>
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy || !ready || waiting > 0} className="h-11 w-full">{busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{busy ? "Please wait…" : waiting > 0 ? `Try again in ${waiting}s` : mode === "login" ? "Sign in" : mode === "forgot" ? "Send reset code" : "Reset password"}</Button>
    </form>
    {mode === "reset" && <div className="mt-5 text-center"><Button type="button" variant="link" disabled={busy || !ready || resend.remaining > 0} onClick={() => void perform("forgot")}>{resend.remaining > 0 ? `Resend code in ${resend.remaining}s` : "Resend code"}</Button><Button type="button" variant="link" disabled={busy} onClick={() => { setMode("forgot"); setError(""); resend.start(0); requestAnimationFrame(() => { emailInput.current?.focus(); emailInput.current?.select() }) }}>Change email</Button></div>}
    <Button type="button" variant="link" disabled={busy || !ready} onClick={() => { setMode(mode === "login" ? "forgot" : "login"); setError("") }} className="mt-5 w-full">{mode === "login" ? "Forgot password?" : "Back to sign in"}</Button>
    {mode === "login" && <p className="mt-3 text-center text-sm text-muted-foreground">Operations team?{" "}<Link href="/admin/login" className="font-medium text-primary underline underline-offset-4">Admin sign in</Link></p>}
  </AuthCard>
}
