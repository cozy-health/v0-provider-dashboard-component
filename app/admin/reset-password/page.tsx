"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ResetPassword() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setError(null)
    if (sent && fields.get("password") !== fields.get("confirmation")) {
      setError("Passwords must match.")
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/admin-password/${sent ? "reset-password" : "forgot-password"}`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Cozy-Request": "1" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), ...(sent ? { token: fields.get("token"), password: fields.get("password") } : {}) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || "Please retry later.")
      if (sent) {
        router.replace("/admin/login")
        toast.success("Password reset. Log in with your new one.")
      } else setSent(true)
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return <main className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
    <section className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">Reset admin password</h1>
      {sent && <p role="status" className="text-sm text-muted-foreground mt-4">If an account exists with that email, you&apos;ll receive a reset code.</p>}
      <form onSubmit={submit} className="space-y-5 mt-6">
        <label className="block text-sm">Email<Input type="email" autoComplete="username" required maxLength={190} value={email} onChange={event => setEmail(event.target.value)} readOnly={sent} className="mt-2" /></label>
        {sent && <>
          <label className="block text-sm">6-digit reset code<Input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required className="mt-2" /></label>
          <label className="block text-sm">New password<Input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={255} required className="mt-2" /></label>
          <label className="block text-sm">Confirm password<Input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={255} required className="mt-2" /></label>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : sent ? "Reset password" : "Send reset link"}</Button>
      </form>
      {sent && <Button variant="link" disabled={busy} onClick={() => { setSent(false); setError(null) }}>Request a new code or change email</Button>}
      <Link href="/admin/login" className="block text-sm underline mt-6">Back to admin sign in</Link>
    </section>
  </main>
}
