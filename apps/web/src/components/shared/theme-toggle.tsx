"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui"
import { THEME_KEY, type Theme } from "@/lib/theme"

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  return () => observer.disconnect()
}
const getTheme = (): Theme =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark"

export function ThemeToggle({ className }: { className?: string }) {
  const theme = React.useSyncExternalStore(subscribe, getTheme, () => "dark" as Theme)

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {}
  }

  const isLight = theme === "light"
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={toggle}
      aria-label={`Switch to ${isLight ? "Night" : "Day"} theme`}
    >
      {isLight ? <Moon /> : <Sun />} {isLight ? "Night" : "Day"}
    </Button>
  )
}
