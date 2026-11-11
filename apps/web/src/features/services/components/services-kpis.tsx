import { StoryBanner } from "@/components/shared"
import type { ServiceRowData } from "../lib"

interface ServicesKpisProps {
  rows: ServiceRowData[]
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat([], { style: "currency", currency, maximumFractionDigits: 0 }).format(
    amount
  )

export function ServicesKpis({ rows }: ServicesKpisProps) {
  const receiving = rows.filter((row) => row.status === "receiving").length
  const quiet = rows.filter((row) => row.status === "quiet").length
  const withProblems = rows.filter((row) => row.status === "problem")
  const valued = rows.filter((row) => row.impact !== null)
  const impact = valued.reduce((sum, row) => sum + (row.impact ?? 0), 0)
  const currency = valued[0]?.currency ?? "USD"

  const headline =
    rows.length === 0
      ? "No service is reporting yet"
      : withProblems.length > 0
        ? `${withProblems.length} service${withProblems.length === 1 ? " has" : "s have"} a problem`
        : quiet > 0
          ? `${quiet} service${quiet === 1 ? " has" : "s have"} gone quiet`
          : "Every service is healthy"

  return (
    <StoryBanner
      tone={
        withProblems.length > 0 ? "bad" : quiet > 0 ? "warn" : rows.length === 0 ? "idle" : "ok"
      }
      headline={headline}
      detail={
        rows.length === 0
          ? "Connect an integration. Each app that sends logs shows up here with its health and business impact."
          : withProblems.length > 0
            ? withProblems.map((row) => row.name).join(", ")
            : "Services appear when they send logs and are marked quiet after 15 minutes of silence."
      }
      stats={[
        { label: "Connected", value: rows.length },
        { label: "Receiving now", value: receiving },
        { label: "Quiet", value: quiet },
        { label: "Impact, 7 days", value: valued.length ? money(impact, currency) : "-" },
      ]}
    />
  )
}
