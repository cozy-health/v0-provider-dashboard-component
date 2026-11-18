import Image from "next/image"
import { ShieldCheck, HeartHandshake } from "lucide-react"

export function AuthCard({ title, description, audience, children, compactSpacing = false }: { title: string; description: string; audience: string; children: React.ReactNode; compactSpacing?: boolean }) {
  return <main className="auth-workspace">
    <aside className="auth-story"><div className="flex items-center gap-3"><Image src="/images/cozy-logo.png" alt="" width={42} height={42} /><span className="text-lg font-semibold">Cozy Health</span></div><div><HeartHandshake size={46} className="mb-8 text-[#75d9b2]" aria-hidden="true" /><h2>A little more<br />space for care.</h2><p>A thoughtful workspace for the people supporting everyday wellbeing.</p></div><span className="text-xs tracking-wide text-[#bed0e2]">Carefully connected. Always considerate.</span></aside>
    <div className="auth-form-region"><section className={`auth-form-panel min-w-0 [overflow-wrap:anywhere] ${compactSpacing ? "!p-[min(24px,4vw)] sm:!p-8" : ""}`}>
      <div className="mb-7 flex items-center gap-3"><Image src="/images/cozy-logo.png" alt="Cozy Health" width={48} height={48} className="rounded-xl" />
        <div className="min-w-0"><p className="text-sm font-semibold">Cozy Health</p><p className="text-xs text-muted-foreground">{audience}</p></div>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children}
      <div className="mt-7 flex items-start gap-2 border-t pt-5 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><p>For your privacy, signed-in sessions end after 30 minutes.</p></div>
    </section></div>
  </main>
}
