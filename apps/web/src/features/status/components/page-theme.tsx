"use client"

import * as React from "react"

interface PageThemeProps {
  theme: "system" | "light" | "dark"
  hideFromSearch: boolean
}

export function PageTheme({ theme, hideFromSearch }: PageThemeProps) {
  React.useEffect(() => {
    const root = document.documentElement
    const previous = root.dataset.theme
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => {
      root.dataset.theme = theme === "system" ? (media.matches ? "dark" : "light") : theme
    }
    apply()
    media.addEventListener("change", apply)
    return () => {
      media.removeEventListener("change", apply)
      if (previous) root.dataset.theme = previous
      else delete root.dataset.theme
    }
  }, [theme])

  return hideFromSearch ? <meta name="robots" content="noindex, nofollow" /> : null
}
