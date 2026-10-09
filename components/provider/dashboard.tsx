"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Users, BookOpen, FileText, Settings, Shield, LogOut } from "lucide-react"
import { toast } from "sonner"
import { api, Client, Provider, freshNavigation } from "@/lib/provider-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, Empty, Failure, Loading, useData, date } from "./data-list"
import { PatientView } from "./patient-view"
import { ResourceLibrary, Reports, AuditLog, ProviderSettings } from "./portal-pages"

const navigation = [{ name: "Patients", icon: Users }, { name: "Resources", icon: BookOpen }, { name: "Reports", icon: FileText }, { name: "Audit log", icon: Shield }, { name: "Settings", icon: Settings }] as const
export function ProviderDashboard({ expires }: { expires: number }) {
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
  return <div className="min-h-screen bg-background md:flex">
    <aside className="bg-sidebar text-sidebar-foreground md:w-64 md:shrink-0 md:min-h-screen border-r border-sidebar-border">
      <div className="flex items-center gap-3 p-6 border-b border-sidebar-border"><Image src="/images/cozy-logo.png" alt="Cozy" width={40} height={40} className="rounded-lg" /><div><p className="font-semibold text-lg">Cozy Health</p><p className="text-xs opacity-70">Provider Dashboard</p></div></div>
      <nav aria-label="Main navigation" className="flex overflow-x-auto gap-1 p-3 md:flex-col">{navigation.map(({ name, icon: Icon }) => <Button key={name} variant="ghost" aria-current={view === name ? "page" : undefined} onClick={() => { setView(name); setPatient(null) }} className={`justify-start shrink-0 ${view === name ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}><Icon className="size-4" />{name}</Button>)}</nav>
      <div className="p-4 border-t border-sidebar-border"><p className="text-sm font-medium break-words">{provider?.name || "Provider account"}</p><p className="text-xs opacity-70 mb-3 break-words">{provider?.practice}</p><Button variant="ghost" onClick={logout} disabled={signingOut}><LogOut className="size-4" />{signingOut ? "Signing out…" : "Sign out"}</Button></div>
    </aside>
    <main className="flex-1 min-w-0 p-4 sm:p-8 max-w-7xl">
      <header className="mb-8"><p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Cozy Health · Provider portal</p><h1 className="text-3xl font-semibold">{patient ? "Patient overview" : view}</h1><p className="mt-2 text-sm text-muted-foreground">Patient sharing choices control the information available here.</p></header>
      {profile.loading ? <Loading /> : profile.error ? <Failure error={profile.error} retry={profile.reload} /> : provider && <>
        {view === "Patients" && (patient ? <PatientView key={patient} id={patient} back={() => setPatient(null)} /> : <Roster select={setPatient} />)}
        {view === "Resources" && <ResourceLibrary />}
        {view === "Reports" && <Reports />}
        {view === "Audit log" && <AuditLog />}
        {view === "Settings" && <ProviderSettings provider={provider} saved={profile.reload} />}
      </>}
    </main>
  </div>
}

function Roster({ select }: { select: (id: number) => void }) {
  const { data, error, loading, reload } = useData<Client[]>("clients")
  const [search, setSearch] = useState("")
  useEffect(() => { const refresh = () => reload(); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh) }, [reload])
  if (loading) return <Loading />
  if (error) return <Failure error={error} retry={reload} />
  const filtered = (data || []).filter(client => client.name.toLowerCase().includes(search.toLowerCase()) || String(client.user_id).includes(search))
  return <div className="space-y-5"><div className="flex gap-3"><Input aria-label="Search patients" placeholder="Search by first name or patient ID" value={search} onChange={event => setSearch(event.target.value)} /><Button variant="outline" onClick={reload}>Refresh</Button></div>
    {!data?.length ? <Empty>No linked patients yet. Patients connect to your registered email through My Provider in the Cozy Health app.</Empty> : !filtered.length ? <Empty>No patients match your search.</Empty> : filtered.map(client => <Card key={client.user_id}><div className="flex flex-wrap gap-4 items-center justify-between"><div><h2 className="font-semibold text-lg">{client.name} <span className="font-normal text-sm text-muted-foreground">· Patient #{client.user_id}</span></h2><p className="text-xs text-muted-foreground mt-1">Linked {date(client.linked_at)}</p><div className="flex flex-wrap gap-2 mt-3">{Object.entries(client.consent_flags).map(([type, shared]) => <Badge key={type} variant={shared ? "secondary" : "outline"}>{type}: {shared ? "shared" : "private"}</Badge>)}</div></div><Button onClick={() => select(client.user_id)}>View patient</Button></div></Card>)}
  </div>
}
