"use client"

import Image from "next/image"
import { useCallback, useState, type ReactNode } from "react"
import { ChevronRight, Menu, ShieldCheck, PanelLeftClose, PanelLeftOpen, Paintbrush } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WorkspacePreferences, useWorkspacePreferences, AppearanceSettings } from "./preferences"
import { WorkspaceTour } from "./workspace-tour"
import { useDesktopNavigation } from "@/hooks/use-desktop-navigation"

type ShellProps = {
  audience: string; context: string; name: string; navigation: ReactNode;
  accountAction: ReactNode; children: ReactNode
}
export function WorkspaceShell(props: ShellProps) {
  return <WorkspacePreferences role={props.audience === "Administration" ? "admin" : "provider"}><WorkspaceShellBody {...props} /></WorkspacePreferences>
}
function WorkspaceShellBody({ audience, context, name, navigation, accountAction, children }: ShellProps) {
  const preferences = useWorkspacePreferences()
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDesktopNavigation(close)
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? "").join("").toUpperCase() || "CH"
  const brand = <div className="workspace-brand"><span className="workspace-brand-mark"><Image src="/images/cozy-logo.png" alt="Cozy Health" width={34} height={34} /></span><div><strong>Cozy Health</strong><span>{audience}</span></div></div>
  const account = <div className="workspace-account"><span className="workspace-avatar" aria-hidden="true">{initials}</span><div className="min-w-0 flex-1"><p className="truncate font-medium" title={name}>{name}</p><p className="workspace-account-caption">{audience}</p></div>{accountAction}</div>
  const links = <div className="workspace-navigation" onClick={close}>{navigation}</div>
  return <div className="workspace-app" data-layout={preferences.value.layout} data-density={preferences.value.density} data-sidebar={preferences.value.sidebar_collapsed ? "collapsed" : "expanded"}>
    <a className="workspace-skip" href="#workspace-content">Skip to content</a>
    <aside className="workspace-sidebar hidden lg:flex">
      {brand}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{links}</div>
      <div className="workspace-privacy"><ShieldCheck size={16} aria-hidden="true" /><span>Care, with clarity.<br />Your private workspace.</span></div>
      {account}
    </aside>
    <div className="workspace-frame">
      <Sheet open={open} onOpenChange={setOpen}>
        <header className="workspace-topbar">
          <SheetTrigger asChild><Button className="lg:hidden" size="icon" variant="outline" aria-label="Open navigation"><Menu size={20} /></Button></SheetTrigger>
          <Button className="workspace-collapse hidden lg:inline-flex" size="icon" variant="ghost" disabled={preferences.loading || preferences.saving || Boolean(preferences.error)} aria-label={preferences.value.sidebar_collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => void preferences.update({ sidebar_collapsed: !preferences.value.sidebar_collapsed })}>{preferences.value.sidebar_collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</Button>
          <div className="workspace-breadcrumb"><span className="hidden sm:inline">{audience}</span><ChevronRight className="hidden sm:block" size={14} aria-hidden="true" /><strong>{context}</strong></div>
          <div className="workspace-topbar-actions"><span className="workspace-private-label"><ShieldCheck size={14} aria-hidden="true" />Private workspace</span><Button variant="outline" className="workspace-appearance-trigger" aria-label="Appearance and layout" onClick={() => setAppearanceOpen(true)}><Paintbrush size={16} /><span className="hidden sm:inline">Appearance</span></Button></div>
        </header>
        <SheetContent side="left" className="workspace-drawer w-[min(19rem,calc(100%-2rem))] gap-0 p-0">
          <SheetHeader className="px-6 py-6 pr-16"><SheetTitle>Cozy Health</SheetTitle><SheetDescription>{audience} navigation</SheetDescription></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{links}</div>{account}
        </SheetContent>
      </Sheet>
      <main id="workspace-content" tabIndex={-1} className="workspace-content"><div className="workspace-content-inner"><WorkspaceTour audience={audience} />{children}</div></main>
    </div>
    <Dialog open={appearanceOpen} onOpenChange={setAppearanceOpen}><DialogContent className="workspace-appearance-dialog max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Workspace preferences</DialogTitle><DialogDescription>Choose how your private workspace looks and feels.</DialogDescription></DialogHeader><AppearanceSettings /></DialogContent></Dialog>
  </div>
}
