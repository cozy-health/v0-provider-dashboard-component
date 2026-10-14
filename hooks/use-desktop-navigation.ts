"use client"

import { useEffect } from "react"

// A drawer must release its focus trap and scroll lock when the desktop nav appears.
export function useDesktopNavigation(close: () => void) {
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)")
    const changed = () => { if (desktop.matches) close() }
    changed()
    desktop.addEventListener("change", changed)
    return () => desktop.removeEventListener("change", changed)
  }, [close])
}
