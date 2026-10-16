"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import { MessageCircle, Users, BookOpen, FileText, Settings, Shield, LogOut, Menu, UserRoundPlus } from "lucide-react"
import { toast } from "sonner"
import { api, Client, Provider, freshNavigation } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, Empty, Failure, Loading, useData, date } from "./data-list"
import { PatientView } from "./patient-view"
import { ResourceLibrary, Reports, AuditLog, ProviderSettings } from "./portal-pages"
import { ConsentNotice } from "./consent-notice"
import { PatientConnection } from "./patient-connection"
import { ThemeButton } from "@/components/theme-button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet"
import { useDesktopNavigation } from "@/hooks/use-desktop-navigation"
import { QuizInbox } from "./quiz-inbox"

import { Messages } from "./messages"

const navigation = [{ name: "Messages", icon: MessageCircle }, { name: "Patients", icon: Users }, { name: "Shared quiz results", icon: FileText }, { name: "Resources", icon: BookOpen }, { name: "Reports", icon: FileText }, { name: "Audit log", icon: Shield }, { name: "Settings", icon: Settings }] as const
export function ProviderDashboard({ expires }: { expires: number }) {
  const [open, setOpen] = useState(false)
  const closeNavigation = useCallback(() => setOpen(false), [])
  useDesktopNavigation(closeNavigation)
  const profile = useData<{ data: { provider: Provider } }>("me")
  const [view, setView] = useState<string>("Patients")
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
  const nav = <nav aria-label="Main navigation" className="flex flex-col gap-1 p-3">{navigation.map(({ name, icon: Icon }) => <Button key={name} variant="ghost" aria-current={view === name ? "page" : undefined} onClick={() => { setView(name); setPatient(null); closeNavigation() }} className={`h-auto min-h-11 justify-start whitespace-normal text-left ${view === name ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}><Icon className="size-4 shrink-0" />{name}</Button>)}</nav>
  const account = <div className="mt-auto border-t border-sidebar-border p-4"><p className="break-words text-sm font-medium">{provider?.name || "Provider account"}</p><p className="mb-3 break-words text-xs text-muted-foreground">{provider?.practice}</p><Button className="min-h-11" variant="ghost" onClick={logout} disabled={signingOut}><LogOut className="size-4" />{signingOut ? "Signing out..." : "Sign out"}</Button></div>
  const brand = <><Image src="/images/cozy-logo.png" alt="Cozy" width={40} height={40} className="shrink-0 rounded-lg" /><div className="min-w-0 flex-1"><p className="text-base font-semibold sm:text-lg">Cozy Health</p><p className="text-xs text-muted-foreground">Provider Dashboard</p></div></>
  return <div className="min-h-screen bg-background lg:flex">
    <Sheet open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-card px-4 py-3 lg:hidden"><SheetTrigger asChild><Button variant="outline" size="icon" className="size-11 shrink-0" aria-label="Open navigation"><Menu /></Button></SheetTrigger><div className="flex min-w-0 flex-1 items-center gap-2">{brand}</div><ThemeButton /></header>
      <SheetContent side="left" className="flex h-dvh w-[min(20rem,calc(100%-2rem))] flex-col gap-0 bg-sidebar text-sidebar-foreground">
        <SheetHeader className="border-b pr-16"><SheetTitle>Cozy Health</SheetTitle><SheetDescription>Provider navigation</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>{account}
      </SheetContent>
    </Sheet>
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex items-center gap-3 border-b border-sidebar-border p-4">{brand}<ThemeButton /></div>
      <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>{account}
    </aside>
    <main className="min-w-0 flex-1 max-w-7xl p-4 pb-12 sm:p-6 lg:p-8">
      {provider && <ConsentNotice key={provider.id} ownerId={provider.id} />}
      <header className="mb-8"><p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Cozy Health · Provider portal</p><h1 className="break-words text-2xl font-semibold sm:text-3xl">{view === "Patient messages" ? "Messages" : patient ? "Patient overview" : view}</h1><p className="mt-2 text-sm text-muted-foreground">Patient sharing choices control the information available here.</p></header>
      {profile.loading ? <Loading /> : profile.error ? <Failure error={profile.error} retry={profile.reload} /> : provider && <>
        {view === "Patients" && (patient ? <><Button className="mb-4" onClick={() => setView("Patient messages")}>Message patient</Button><PatientView key={patient} id={patient} back={() => setPatient(null)} /></> : <Roster select={setPatient} email={provider.email} />)}
        {view === "Messages" && <Messages />}
        {view === "Patient messages" && <Messages userId={patient ?? undefined} />}
        {view === "Resources" && <ResourceLibrary />}
        {view === "Reports" && <Reports />}
        {view === "Shared quiz results" && <QuizInbox />}
        {view === "Audit log" && <AuditLog />}
        {view === "Settings" && <ProviderSettings provider={provider} saved={profile.reload} />}
      </>}
    </main>
  </div>
}

function Roster({ select, email }: { select: (id: number) => void; email: string }) {
  const { data, error, loading, reload } = useData<Client[]>("clients")
  const [search, setSearch] = useState(""), [adding, setAdding] = useState(false)
  useEffect(() => { const refresh = () => reload(); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh) }, [reload])
  if (loading) return <Loading />
  if (error) return <Failure error={error} retry={reload} />
  const filtered = (data || []).filter(client => client.name.toLowerCase().includes(search.toLowerCase()) || String(client.user_id).includes(search))
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Build your patient roster at your own pace.</p><Button onClick={() => setAdding(true)}><UserRoundPlus aria-hidden="true" className="size-4" />Add patient</Button></div>{adding && <PatientConnection email={email} close={() => setAdding(false)} connected={() => { toast.success("Patient connected."); reload() }} />}<div className="flex flex-col gap-3 sm:flex-row"><Input aria-label="Search patients" placeholder="Search by first name or patient ID" value={search} onChange={event => setSearch(event.target.value)} /><Button variant="outline" onClick={reload}>Refresh</Button></div>
    {!data?.length ? <Empty>No linked patients yet. You can use your workspace without patients. Ask a patient to send an invitation to your registered email from My Provider in the Cozy app, then choose Add patient.</Empty> : !filtered.length ? <Empty>No patients match your search.</Empty> : filtered.map(client => <Card key={client.user_id}><div className="flex flex-wrap gap-4 items-center justify-between"><div><h2 className="break-words font-semibold text-lg">{client.name} <span className="font-normal text-sm text-muted-foreground">· Patient #{client.user_id}</span></h2><p className="text-xs text-muted-foreground mt-1">Linked {date(client.linked_at)}</p><div className="flex flex-wrap gap-2 mt-3">{Object.entries(client.consent_flags).map(([type, shared]) => <Badge key={type} variant={shared ? "secondary" : "outline"}>{type}: {shared ? "shared" : "private"}</Badge>)}</div></div><Button onClick={() => select(client.user_id)}>View patient</Button></div></Card>)}
  </div>
}
