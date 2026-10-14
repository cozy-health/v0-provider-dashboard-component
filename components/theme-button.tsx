"use client"
import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
const subscribe = () => () => {}
export function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const dark = resolvedTheme === "dark"
  const label = dark ? "Switch to light mode" : "Switch to dark mode"
  return <Button type="button" variant="outline" size="icon" className="size-11 shrink-0 rounded-full" disabled={!mounted} aria-label={mounted ? label : "Loading appearance"} title={mounted ? label : "Loading appearance"} onClick={() => setTheme(dark ? "light" : "dark")}>
    {mounted && (dark ? <Sun aria-hidden="true" className="size-5" /> : <Moon aria-hidden="true" className="size-5" />)}
  </Button>
}
