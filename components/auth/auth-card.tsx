import Image from "next/image"
import { ShieldCheck } from "lucide-react"

export function AuthCard({ title, description, audience, children }: { title: string; description: string; audience: string; children: React.ReactNode }) {
  return <main className="min-h-screen grid place-items-center bg-background px-4 py-12 sm:px-6">
    <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-7 flex items-center gap-3"><Image src="/images/cozy-logo.png" alt="Cozy Health" width={48} height={48} className="rounded-xl" />
        <div><p className="text-sm font-semibold">Cozy Health</p><p className="text-xs text-muted-foreground">{audience}</p></div>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children}
      <div className="mt-7 flex items-start gap-2 border-t pt-5 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>For your privacy, signed-in sessions end after 30 minutes.</p></div>
    </section>
  </main>
}
