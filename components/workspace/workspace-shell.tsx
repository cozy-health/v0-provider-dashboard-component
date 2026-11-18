"use client"

import Image from "next/image"
import { useCallback, useState, type ReactNode } from "react"
import { ChevronRight, Menu, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useDesktopNavigation } from "@/hooks/use-desktop-navigation"

export function WorkspaceShell({ audience, context, name, navigation, appearance, accountAction, children }: {
  audience: string
  context: string
  name: string
  navigation: ReactNode
  appearance: ReactNode
  accountAction: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDesktopNavigation(close)
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? "").join("").toUpperCase() || "CH"
  const brand = <div className="workspace-brand"><span className="workspace-brand-mark"><Image src="/images/cozy-logo.png" alt="Cozy Health" width={34} height={34} /></span><div><strong>Cozy Health</strong><span>{audience}</span></div></div>
  const account = <div className="workspace-account"><span className="workspace-avatar" aria-hidden="true">{initials}</span><div className="min-w-0 flex-1"><p className="truncate font-medium" title={name}>{name}</p><p className="workspace-account-caption">{audience}</p></div>{accountAction}</div>
  const links = <div className="workspace-navigation" onClick={close}>{navigation}</div>
  return <div className="workspace-app">
    <a className="workspace-skip" href="#workspace-content">Skip to content</a>
    <aside className="workspace-sidebar hidden lg:flex">
      {brand}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{links}</div>
      <div className="workspace-privacy"><ShieldCheck size={16} aria-hidden="true" /><span>Built around care.<br />Patient choices come first.</span></div>
      {account}
    </aside>
    <div className="workspace-frame">
      <Sheet open={open} onOpenChange={setOpen}>
        <header className="workspace-topbar">
          <SheetTrigger asChild><Button className="lg:hidden" size="icon" variant="outline" aria-label="Open navigation"><Menu size={20} /></Button></SheetTrigger>
          <div className="workspace-breadcrumb"><span className="hidden sm:inline">{audience}</span><ChevronRight className="hidden sm:block" size={14} aria-hidden="true" /><strong>{context}</strong></div>
          <div className="workspace-topbar-actions"><span className="workspace-private-label"><ShieldCheck size={14} aria-hidden="true" />Private workspace</span>{appearance}<span className="workspace-topbar-avatar" aria-label={`Signed in as ${name}`}>{initials}</span></div>
        </header>
        <SheetContent side="left" className="workspace-drawer w-[min(19rem,calc(100%-2rem))] gap-0 p-0">
          <SheetHeader className="px-6 py-6 pr-16"><SheetTitle>Cozy Health</SheetTitle><SheetDescription>{audience} navigation</SheetDescription></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{links}</div>{account}
        </SheetContent>
      </Sheet>
      <main id="workspace-content" tabIndex={-1} className="workspace-content"><div className="workspace-content-inner">{children}</div></main>
    </div>
  </div>
}
