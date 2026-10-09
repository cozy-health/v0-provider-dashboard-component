"use client"

import { useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/auth/password-input"
import { AuthCard } from "@/components/auth/auth-card"
import { useCooldown } from "@/components/auth/use-cooldown"

const subscribe = () => () => {}
export default function ResetPassword() {
  const router = useRouter()
  const ready = useSyncExternalStore(subscribe, () => true, () => false)
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const resend = useCooldown(), reset = useCooldown()
  async function request(action: "forgot-password" | "reset-password", fields?: FormData) {
    if (busy) return
    setError(null); setBusy(true)
    try {
      const response = await fetch(`/api/admin-password/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Cozy-Request": "1" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), ...(action === "reset-password" ? { token: fields?.get("token"), password: fields?.get("password") } : {}) }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 429) {
        const raw = Number(response.headers.get("Retry-After"))
        const seconds = Number.isFinite(raw) && raw > 0 ? raw : 60
        const cooldown = action === "forgot-password" ? resend : reset
        cooldown.start(seconds)
      }
      if (!response.ok) throw new Error(data.message || "Password reset is temporarily unavailable. Please retry.")
      if (action === "reset-password") { router.replace("/admin/login"); toast.success("Password reset. Log in with your new one.") }
      else {
        setEmail(email.trim().toLowerCase()); setSent(true); resend.start(60)
        if (sent) toast.success("If an account exists, a new reset code is on its way.")
      }
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    if (sent && fields.get("password") !== fields.get("confirmation")) { setError("Passwords must match."); return }
    void request(sent ? "reset-password" : "forgot-password", fields)
  }
  const waiting = sent ? reset.remaining : resend.remaining
  return <AuthCard title={sent ? "Choose a new password" : "Reset admin password"} audience="Operations" description={sent ? "Enter the latest six-digit code from your email, then choose your new password." : "We’ll email you a six-digit code to reset your password."}>
    <p className="mb-5 text-xs font-medium text-muted-foreground">Step {sent ? "2" : "1"} of 2 · {sent ? "Code and new password" : "Email address"}</p>
    {sent && <p role="status" className="mb-5 rounded-lg bg-muted p-3 text-sm leading-relaxed">If an account exists with that email, you&apos;ll receive a reset code. Check your inbox and spam folder. Codes expire after 15 minutes.</p>}
    <form onSubmit={submit} aria-busy={busy} className="space-y-5">
      <fieldset disabled={busy} className="space-y-5">
        <div className="space-y-2"><label htmlFor="reset-email" className="block text-sm font-medium">Email</label><Input ref={emailInput} id="reset-email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={190} value={email} onChange={event => setEmail(event.target.value)} readOnly={sent} className="h-11" /></div>
        {sent && <>
          <div className="space-y-2"><label htmlFor="reset-code" className="block text-sm font-medium">6-digit reset code</label><Input id="reset-code" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} autoFocus required className="h-11 text-center text-lg tracking-[0.3em]" /></div>
          <PasswordInput label="New password" name="password" autoComplete="new-password" minLength={12} maxLength={255} required hint="Use at least 12 characters. A long, unique passphrase works well." />
          <PasswordInput label="Confirm password" name="confirmation" autoComplete="new-password" minLength={12} maxLength={255} required />
        </>}
      </fieldset>
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={busy || !ready || waiting > 0}>{busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}{busy ? "Please wait…" : waiting > 0 ? `Try again in ${waiting}s` : sent ? "Reset password" : "Send reset code"}</Button>
    </form>
    {sent && <div className="mt-5 space-y-2 text-center"><p className="text-xs text-muted-foreground">No code yet? Check spam before requesting another.</p>
      <Button type="button" variant="link" disabled={busy || !ready || resend.remaining > 0} onClick={() => void request("forgot-password")}>{resend.remaining > 0 ? `Resend code in ${resend.remaining}s` : "Resend code"}</Button>
      <Button type="button" variant="link" disabled={busy} onClick={() => { setSent(false); setError(null); resend.start(0); requestAnimationFrame(() => { emailInput.current?.focus(); emailInput.current?.select() }) }}>Change email</Button>
    </div>}
    <Link href="/admin/login" className="mt-6 block text-center text-sm font-medium text-primary underline underline-offset-4">Back to admin sign in</Link>
  </AuthCard>
}
