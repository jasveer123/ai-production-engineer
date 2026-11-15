import type { Dashboard } from "../schemas"

export function exportDashboard(dashboard: Dashboard): void {
  const body = { name: dashboard.name, widgets: dashboard.widgets, variables: dashboard.variables }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(body, null, 2)], { type: "application/json" })
  )
  const link = document.createElement("a")
  link.href = url
  link.download = `${dashboard.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.json`
  link.click()
  URL.revokeObjectURL(url)
}
