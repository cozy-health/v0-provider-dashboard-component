"use client"

import { useEffect, useRef, useState, type MouseEvent } from "react"
import { createPortal } from "react-dom"
import { CircleHelp, Compass, ArrowRight, LayoutDashboard, PanelLeft, Palette, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useWorkspacePreferences } from "./preferences"

export function WorkspaceTour({ audience }: { audience: string }) {
  const { value, loading, saving, error, update } = useWorkspacePreferences()
  const [open, setOpen] = useState(false), [step, setStep] = useState(0)
  useEffect(() => {
    const workspace = document.querySelector<HTMLElement>(".workspace-app")
    if (!workspace || !open) return
    workspace.dataset.tourHighlight = String(step)
    return () => { delete workspace.dataset.tourHighlight }
  }, [open, step])
  const [helpTargets, setHelpTargets] = useState<HTMLElement[]>([])
  const invoker = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { setHelpTargets(Array.from(document.querySelectorAll<HTMLElement>('[data-workspace-help]'))) }, [])
  const provider = audience === "Provider portal"
  const steps = [
    { icon: PanelLeft, title: "Everything has a place", text: provider ? "Use the sidebar to move between patients, messages, shared results and resources. On a smaller screen, open Navigation at the top." : "The sidebar groups your authorized work into overview, people, community and operations. You only see the tools your account can use." },
    { icon: LayoutDashboard, title: provider ? "Start with your patients" : "Start with what needs attention", text: provider ? "Accept a patient invitation from Patients. Their sharing choices determine which records you can open. Messages keeps your conversations and shared records together." : "Review your overview, then open the relevant work queue. Support, privacy and moderation cases keep the record, history and review actions together." },
    { icon: ShieldCheck, title: "Context before action", text: provider ? "Check the selected patient and current sharing status before reviewing or sending. Missing or withdrawn information stays unavailable; a tour never grants access." : "Read the selected record and current status before making a decision. Important changes retain their confirmation and audit history." },
    { icon: Palette, title: "Make this space yours", text: "Open Appearance to choose light, dark or system mode, an accent, your layout and spacing. Your choices follow your account. Replay this guide from Help whenever you need it." },
  ]
  const current = steps[step] ?? steps[0]
  if (!current) return null
  function start(event: MouseEvent<HTMLButtonElement>) { invoker.current = event.currentTarget; setStep(value.tour_state === 'completed' ? 0 : value.tour_step); setOpen(true) }
  async function close() { await update({ tour_state: 'dismissed', tour_step: step }); setOpen(false) }
  async function next() { if (step === steps.length - 1) { if (await update({ tour_state: 'completed', tour_step: step, tour_version: 1 })) setOpen(false) } else if (await update({ tour_step: step + 1 })) setStep(n => n + 1) }
  return <>
    {!loading && !error && value.tour_state === 'new' && <section className="workspace-welcome" aria-label="Welcome to your workspace"><span className="welcome-icon"><Compass size={22} /></span><div><h2>Make yourself at home</h2><p>A short guide to your {provider ? 'care' : 'admin'} workspace. You can explore at your own pace.</p></div><div className="flex flex-wrap gap-2"><Button variant="ghost" disabled={saving} onClick={() => void update({ tour_state: 'dismissed' })}>Maybe later</Button><Button disabled={saving} onClick={start}>Show me around<ArrowRight size={15} /></Button></div></section>}
    {helpTargets.map((target, index) => createPortal(<button type="button" data-workspace-guide-trigger className="workspace-guide-trigger" aria-label={value.tour_state === 'dismissed' ? 'Continue workspace guide' : 'Workspace guide'} disabled={loading || saving || Boolean(error)} onClick={start}><CircleHelp size={18} /><span>Help & guide</span></button>, target, `help-${index}`))}

    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen && !saving) void close() }}><DialogContent onCloseAutoFocus={event => {
      event.preventDefault()
      const target = invoker.current?.isConnected ? invoker.current : Array.from(document.querySelectorAll<HTMLButtonElement>('[data-workspace-guide-trigger]')).find(button => button.offsetParent !== null)
      target?.focus({ preventScroll: true })
    }} className="workspace-tour-dialog sm:max-w-lg" onEscapeKeyDown={event => { if (saving) event.preventDefault() }} onPointerDownOutside={event => { if (saving) event.preventDefault() }}>
      <DialogHeader><span className="tour-illustration" aria-hidden="true"><current.icon size={38} /><span /><span /><span /></span><p className="workspace-kicker">Your workspace Â· {step + 1} of {steps.length}</p><DialogTitle className="text-2xl">{current.title}</DialogTitle><DialogDescription className="pt-2 text-sm leading-7">{current.text}</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error} Close the guide and retry appearance from the top bar.</p>}
      <div className="tour-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>{steps.map((_, index) => <span key={index} data-current={index <= step} />)}</div>
      <div className="flex flex-wrap justify-between gap-3"><Button variant="ghost" disabled={saving} onClick={() => void close()}>Continue later</Button><div className="flex gap-2">{step > 0 && <Button variant="outline" disabled={saving} onClick={() => setStep(n => n - 1)}>Back</Button>}<Button disabled={saving || Boolean(error)} onClick={() => void next()}>{saving ? 'Saving…' : step === steps.length - 1 ? 'Ready to explore' : 'Next'}<ArrowRight size={15} /></Button></div></div>
    </DialogContent></Dialog>
  </>
}
