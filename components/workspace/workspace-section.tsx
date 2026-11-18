import type { ReactNode } from "react"

export function WorkspaceSection({ title, description, actions, children, className = "" }: {
  title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string
}) {
  return <section className={`workspace-panel ${className}`}>
    <header className="workspace-panel-header"><div className="min-w-0"><h2 className="text-base font-semibold">{title}</h2>{description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}</div>{actions && <div className="shrink-0">{actions}</div>}</header>
    <div className="workspace-section-body">{children}</div>
  </section>
}

export function WorkspaceNote({ title, children }: { title: string; children: ReactNode }) {
  return <aside className="workspace-panel workspace-context-card"><h2>{title}</h2><div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div></aside>
}
