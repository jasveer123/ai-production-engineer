import type { ErrorDetail } from "../schemas"
import { FactList } from "./fact-list"

interface EventFactsProps {
  data: ErrorDetail
}

export function EventFacts({ data }: EventFactsProps) {
  const latest = data.latest
  const request = latest?.request
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <FactList title="User" rows={Object.entries(latest?.user ?? {})} />
      <FactList
        title="Request"
        rows={[
          ...(request?.method ? [["Method", request.method] as [string, string]] : []),
          ...(request?.url ? [["URL", request.url] as [string, string]] : []),
        ]}
      />
      <FactList title="Tags" rows={Object.entries(latest?.tags ?? {})} />
      <FactList
        title="Releases"
        rows={data.byRelease.map((r) => [r.release, `${r.count.toLocaleString()} events`])}
      />
      <FactList
        title="Environments"
        rows={data.byEnvironment.map((r) => [r.environment, `${r.count.toLocaleString()} events`])}
      />
      <FactList
        title="Tag values"
        rows={data.tagFacets.map((f) => [
          f.key,
          f.values.map((v) => `${v.value} (${v.count})`).join(", "),
        ])}
      />
    </div>
  )
}
