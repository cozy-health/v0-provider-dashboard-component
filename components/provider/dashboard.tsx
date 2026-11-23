"use client"

import { useEffect, useState } from "react"
import { LayoutDashboard, MessageCircle, Users, BookOpen, FileText, Settings, Shield, LogOut } from "lucide-react"
import { toast } from "sonner"
import { api, Provider, freshNavigation } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Failure, Loading, useData } from "./data-list"
import { PatientView } from "./patient-view"
import { ResourceLibrary, Reports, AuditLog, ProviderSettings } from "./portal-pages"
import { ConsentNotice } from "./consent-notice"
import { WorkspaceShell } from "@/components/workspace/workspace-shell"
import { QuizInbox } from "./quiz-inbox"

import { ProviderOverview } from "./overview"
import { Messages } from "./messages"
import { PatientRoster } from "./patient-roster"

const navigation = [{ name: "Overview", icon: LayoutDashboard }, { name: "Messages", icon: MessageCircle }, { name: "Patients", icon: Users }, { name: "Shared assessment results", icon: FileText }, { name: "Resources", icon: BookOpen }, { name: "Reports", icon: FileText }, { name: "Audit log", icon: Shield }, { name: "Settings", icon: Settings }] as const
const viewDescriptions: Record<string, string> = {
  Overview: "Your patient connections, shared results and follow-up priorities in one place.",
  Patients: "Find connected patients and review the information they choose to share.",
  Messages: "Keep patient conversations and shared records together.",
  "Patient messages": "Continue this patient's conversation and review shared records.",
  "Shared assessment results": "Review results that patients have explicitly shared with you.",
  Resources: "Manage the resources you can assign to connected patients.",
  Reports: "Access generated reports using current patient sharing permissions.",
  "Audit log": "Review your access history and account activity.",
  Settings: "Manage your profile, timezone and sign-in protection.",
}
export function ProviderDashboard({ expires }: { expires: number }) {
  const profile = useData<{ data: { provider: Provider } }>("me")
  const [view, setView] = useState<string>("Overview")
  const [patient, setPatient] = useState<number | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => freshNavigation("/login?expired=1"), Math.max(0, expires - Date.now()))
    return () => window.clearTimeout(timer)
  }, [expires])
  async function logout() {
    setSigningOut(true)
    try { await api("auth/logout", { method: "POST", body: "{}" }); freshNavigation("/login") }
    catch (error) { toast.error((error as Error).message); setSigningOut(false) }
  }
  const provider = profile.data?.data.provider
  const nav = <nav aria-label="Main navigation"><div><p className="workspace-nav-label">Care workspace</p><div className="space-y-1">{navigation.map(({ name, icon: Icon }) => <Button key={name} variant="ghost" aria-label={name} title={name} aria-current={view === name ? "page" : undefined} onClick={() => { setView(name); setPatient(null) }}><Icon className="size-4 shrink-0" /><span>{name}</span></Button>)}</div></div></nav>
  return <div className="cozy-provider"><WorkspaceShell audience="Provider portal" context={patient ? "Patient workspace" : view} name={provider?.name || "Provider account"} navigation={nav} accountAction={<Button variant="ghost" onClick={logout} disabled={signingOut} aria-label={signingOut ? "Signing out..." : "Sign out"} title="Sign out"><LogOut className="size-4" /></Button>}>
      <header className={`dashboard-page-heading mb-7 ${patient ? "care-patient-heading" : ""}`}><p className="mb-3 text-[11px] font-semibold uppercase tracking-[.15em] text-primary">Your care workspace</p><h1>{view === "Patient messages" ? "Messages" : patient ? "Patient overview" : view}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{patient && view === "Patients" ? "Review this patient's shared records and current sharing choices." : viewDescriptions[view]}</p>{patient && view === "Patients" && <Button onClick={() => setView("Patient messages")}>Message patient</Button>}</header>
      {profile.loading ? <Loading /> : profile.error ? <Failure error={profile.error} retry={profile.reload} /> : provider && <ConsentNotice key={provider.id} ownerId={provider.id}>
        {view === "Overview" && <ProviderOverview navigate={destination => { setPatient(null); setView(destination) }} openPatient={id => { setPatient(id); setView("Patients") }} />}
        {view === "Patients" && (patient ? <><PatientView key={patient} id={patient} back={() => setPatient(null)} /></> : <PatientRoster select={setPatient} email={provider.email} allowConnection title="Patient directory" />)}
        {view === "Messages" && <Messages onOpenPatient={id => { setPatient(id); setView("Patients") }} />}
        {view === "Patient messages" && <Messages userId={patient ?? undefined} onOpenPatient={id => { setPatient(id); setView("Patients") }} />}
        {view === "Resources" && <ResourceLibrary />}
        {view === "Reports" && <Reports />}
        {view === "Shared assessment results" && <QuizInbox />}
        {view === "Audit log" && <AuditLog />}
        {view === "Settings" && <ProviderSettings provider={provider} saved={profile.reload} />}
      </ConsentNotice>}
  </WorkspaceShell></div>
}
