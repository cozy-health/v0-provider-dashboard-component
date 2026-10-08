"use client"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return <Button variant="outline" size="sm" className="fixed bottom-4 right-4 z-50" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>Toggle theme</Button>
}
