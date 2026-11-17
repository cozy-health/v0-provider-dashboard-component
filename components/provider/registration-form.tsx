"use client"

import { useState, useSyncExternalStore, type FormEvent } from "react"
import Link from "next/link"
import { LoaderCircle, UserRoundPlus } from "lucide-react"
import { api, ApiError, freshNavigation } from "@/lib/provider-api"
import { AuthCard } from "@/components/auth/auth-card"
import { PasswordInput } from "@/components/auth/password-input"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useCooldown } from "@/components/auth/use-cooldown"

import { SignInProtection, type ProtectionView } from "./sign-in-protection"
import { ProviderAccountBoundary } from "./account-boundary"
import { browserScope } from "@/lib/provider-auth-scope"

const subscribe = () => () => {}
export function ProviderRegistration() {
 const [protection, setProtection] = useState<ProtectionView>()
 const ready = useSyncExternalStore(subscribe, () => true, () => false)
 const [busy, setBusy] = useState(false), [error, setError] = useState("")
 const cooldown = useCooldown()
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  if (busy || cooldown.remaining) return
  const fields = new FormData(event.currentTarget)
  const password = String(fields.get("password"))
  if (password !== fields.get("password_confirmation")) { setError("Passwords must match."); return }
  setBusy(true); setError("")
  try {
   const result = await api<Partial<ProtectionView>>("auth/register", { method: "POST", body: JSON.stringify({ name: `${String(fields.get("first_name")).trim()} ${String(fields.get("last_name")).trim()}`, email: String(fields.get("email")).trim().toLowerCase(), practice: String(fields.get("practice")).trim() || null, password, password_confirmation: password }) })
   if (result.protection_required) setProtection(result as ProtectionView)
   else freshNavigation("/provider")
  } catch (err) { setError((err as Error).message); if (err instanceof ApiError && err.status === 429) cooldown.start(err.retryAfter || 60); setBusy(false) }
 }
 if (protection) return <ProviderAccountBoundary scope={browserScope()}><SignInProtection initial={protection} /></ProviderAccountBoundary>
 return <AuthCard audience="Provider portal" title="Create provider account" description="Your Cozy workspace starts here. You can add patients whenever you are ready.">
  <form onSubmit={submit} aria-busy={busy} className="space-y-5">
   <fieldset disabled={busy} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">{[["first_name", "First name", "given-name"], ["last_name", "Last name", "family-name"]].map(([name, label, autocomplete]) => <div key={name}><label htmlFor={name} className="mb-2 block text-sm font-medium">{label}</label><Input id={name} name={name} required maxLength={60} autoComplete={autocomplete} /></div>)}</div>
    <div><label htmlFor="register-email" className="mb-2 block text-sm font-medium">Email</label><Input id="register-email" name="email" type="email" required maxLength={190} autoComplete="username" autoCapitalize="none" spellCheck={false} /><p className="mt-2 text-xs text-muted-foreground">Use the address where patients will send connection invitations.</p></div>
    <div><label htmlFor="register-practice" className="mb-2 block text-sm font-medium">Practice / hospital name (optional)</label><Input id="register-practice" name="practice" maxLength={255} autoComplete="organization" /></div>
    <div><PasswordInput label="Password" id="register-password" name="password" required minLength={8} maxLength={255} autoComplete="new-password" /><p className="mt-2 text-xs text-muted-foreground">Use at least 8 characters, including a letter and number.</p></div>
    <div><PasswordInput id="register-confirm" name="password_confirmation" required minLength={8} maxLength={255} autoComplete="new-password" label="Confirm password" /></div>
   </fieldset>
   {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
   <Button className="w-full" disabled={!ready || busy || cooldown.remaining > 0}>{busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <UserRoundPlus aria-hidden="true" className="size-4" />}{busy ? "Creating account..." : cooldown.remaining ? `Try again in ${cooldown.remaining}s` : "Create account"}</Button>
  </form>
  <p className="mt-5 text-center text-sm text-muted-foreground">Already registered? <Link href="/login" className="font-medium text-primary underline underline-offset-4">Sign in</Link></p>
 </AuthCard>
}
