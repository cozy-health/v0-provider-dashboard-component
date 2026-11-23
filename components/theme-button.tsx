"use client"
import { useSyncExternalStore } from "react"
import { useOptionalWorkspacePreferences } from "@/components/workspace/preferences"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
const subscribe = () => () => {}
export function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const workspace = useOptionalWorkspacePreferences()
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const dark = resolvedTheme === "dark"
  const label = dark ? "Switch to light mode" : "Switch to dark mode"
  return <Button type="button" variant="outline" size="icon" className="size-11 shrink-0 rounded-full" disabled={!mounted || Boolean(workspace && (workspace.loading || workspace.saving || workspace.error))} aria-label={mounted ? label : "Loading appearance"} title={mounted ? label : "Loading appearance"} onClick={() => { const next = dark ? "light" : "dark"; if (workspace) void workspace.update({ theme: next }); else setTheme(next) }}>
    {mounted && (dark ? <Sun aria-hidden="true" className="size-5" /> : <Moon aria-hidden="true" className="size-5" />)}
  </Button>
}
