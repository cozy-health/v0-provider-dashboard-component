"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { api } from "@/lib/provider-api"
import { adminApi } from "@/lib/admin-api"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, PanelLeft, Rows3, Check, Monitor, Moon, Sun } from "lucide-react"

export type Preferences = { theme: "system" | "light" | "dark"; accent: "blue" | "violet" | "teal"; layout: "overview" | "focus"; density: "comfortable" | "compact"; sidebar_collapsed: boolean; tour_state: "new" | "dismissed" | "completed"; tour_step: number; tour_version: number }
export const defaultPreferences: Preferences = { theme: "system", accent: "blue", layout: "overview", density: "comfortable", sidebar_collapsed: false, tour_state: "new", tour_step: 0, tour_version: 1 }
type Value = { value: Preferences; loading: boolean; saving: boolean; error: string; update: (patch: Partial<Preferences>) => Promise<boolean>; reload: () => void }
const Context = createContext<Value | null>(null)

export function WorkspacePreferences({ role, children }: { role: "admin" | "provider"; children: ReactNode }) {
  const [value, setValue] = useState(defaultPreferences)
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const { setTheme } = useTheme()
  const busy = useRef(false), generation = useRef(0)
  const transport = role === "admin" ? adminApi : api
  useEffect(() => {
    const controller = new AbortController(), current = ++generation.current
    setLoading(true); setError("")
    void transport<{ data: Preferences }>("workspace-preferences", { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted && generation.current === current) { setValue(result.data); setTheme(result.data.theme) }
    }).catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Appearance could not be loaded.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); generation.current++ }
  }, [transport, revision, setTheme])
  useEffect(() => {
    document.documentElement.dataset.cozyAccent = value.accent
    document.documentElement.dataset.cozyDensity = value.density
    return () => { delete document.documentElement.dataset.cozyAccent; delete document.documentElement.dataset.cozyDensity }
  }, [value.accent, value.density])
  const update = useCallback(async (patch: Partial<Preferences>) => {
    if (busy.current || loading || error) return false
    busy.current = true; setSaving(true)
    const current = generation.current
    try {
      const result = await transport<{ data: Preferences }>("workspace-preferences", { method: "PATCH", body: JSON.stringify(patch) })
      if (current !== generation.current) return false
      setValue(result.data); setTheme(result.data.theme); return true
    } catch (err) { if (current === generation.current) setError(err instanceof Error ? err.message : "Appearance could not be saved."); return false }
    finally { busy.current = false; if (current === generation.current) setSaving(false) }
  }, [transport, loading, error, setTheme])
  return <Context.Provider value={{ value, loading, saving, error, update, reload: () => setRevision(n => n + 1) }}>{children}</Context.Provider>
}

export function useOptionalWorkspacePreferences() { return useContext(Context) }

export function useWorkspacePreferences() { const value = useContext(Context); if (!value) throw new Error("Workspace preferences need their account provider"); return value }

export function AppearanceSettings() {
  const { value, loading, saving, error, update, reload } = useWorkspacePreferences()
  const disabled = loading || saving || Boolean(error)
  return <div className="appearance-settings space-y-7" aria-busy={loading || saving}>
    <div className="flex items-center justify-between gap-4"><div><p className="workspace-kicker">Make it yours</p><h2 className="mt-2 text-xl font-semibold">Appearance & layout</h2><p className="mt-2 text-sm text-muted-foreground">Saved to your account, wherever you sign in.</p></div><span role="status" className="text-xs text-muted-foreground">{loading ? "Loading..." : saving ? "Saving..." : error ? "Not saved" : "Account saved"}</span></div>
    {error && <div role="alert" className="workspace-reading-note"><p>{error}</p><Button variant="outline" className="mt-3" onClick={reload}>Retry appearance</Button></div>}
    <fieldset disabled={disabled}><legend className="mb-3 text-sm font-semibold">Color mode</legend><div className="appearance-options">{([['system', Monitor, 'System'], ['light', Sun, 'Light'], ['dark', Moon, 'Dark']] as const).map(([key, Icon, label]) => <button type="button" key={key} className="appearance-choice" aria-pressed={value.theme === key} onClick={() => void update({ theme: key })}><Icon size={19} /><span>{label}</span>{value.theme === key && <Check size={15} className="ml-auto" />}</button>)}</div></fieldset>
    <fieldset disabled={disabled}><legend className="mb-3 text-sm font-semibold">Accent color</legend><div className="flex flex-wrap gap-3">{(['blue', 'violet', 'teal'] as const).map(accent => <button type="button" key={accent} className="appearance-accent" aria-pressed={value.accent === accent} onClick={() => void update({ accent })}><span className={`accent-swatch accent-${accent}`} />{accent[0]?.toUpperCase()}{accent.slice(1)}{value.accent === accent && <Check size={15} />}</button>)}</div><p className="mt-3 text-xs text-muted-foreground">Status and warning colors stay consistent.</p></fieldset>
    <fieldset disabled={disabled}><legend className="mb-3 text-sm font-semibold">Workspace layout</legend><div className="appearance-layouts">{(['overview', 'focus'] as const).map(layout => <button type="button" key={layout} className="appearance-layout" aria-pressed={value.layout === layout} onClick={() => void update({ layout })}><span className={`layout-miniature miniature-${layout}`} aria-hidden="true"><i /><span><b /><em /><em /></span></span><strong>{layout === 'overview' ? 'Overview' : 'Focus'}</strong><small>{layout === 'overview' ? 'Context and work, together' : 'More room for the task at hand'}</small></button>)}</div></fieldset>
    <div className="grid gap-6 sm:grid-cols-2"><fieldset disabled={disabled}><legend className="mb-3 flex items-center gap-2 text-sm font-semibold"><Rows3 size={16} />Content spacing</legend><div className="appearance-options">{(['comfortable', 'compact'] as const).map(density => <button type="button" key={density} className="appearance-choice capitalize" aria-pressed={value.density === density} onClick={() => void update({ density })}>{density}</button>)}</div></fieldset><fieldset disabled={disabled}><legend className="mb-3 flex items-center gap-2 text-sm font-semibold"><PanelLeft size={16} />Desktop sidebar</legend><div className="appearance-options">{[false, true].map(collapsed => <button type="button" key={String(collapsed)} className="appearance-choice" aria-pressed={value.sidebar_collapsed === collapsed} onClick={() => void update({ sidebar_collapsed: collapsed })}>{collapsed ? 'Collapsed' : 'Expanded'}</button>)}</div></fieldset></div>
    <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5"><p className="text-xs text-muted-foreground">Phone layouts adapt automatically.</p><Button disabled={disabled} variant="outline" onClick={() => void update({ theme: 'system', accent: 'blue', layout: 'overview', density: 'comfortable', sidebar_collapsed: false })}><LayoutDashboard size={16} />Reset appearance</Button></div>
  </div>
}
