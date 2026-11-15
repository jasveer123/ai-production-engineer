import { formatRelativeTime } from "@/lib/format/relative-time"
import { cn } from "@/lib/utils"
import { MAP_NODE } from "../constants"
import { layoutMap } from "../lib"
import type { ServiceMap } from "../schemas"

interface ServiceMapDiagramProps {
  map: ServiceMap
}

const pct = (value: number) => `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`
const ms = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`

export function ServiceMapDiagram({ map }: ServiceMapDiagramProps) {
  const layout = layoutMap(
    map.services.map((service) => service.service),
    map.edges
  )
  const red = new Map(map.services.map((service) => [service.service, service]))
  const { width: w, height: h } = MAP_NODE

  return (
    <div className="overflow-x-auto border border-line bg-sunken">
      <svg
        role="img"
        aria-label={`Service map with ${layout.nodes.length} services and ${layout.links.length} connections`}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto"
        style={{ width: `${layout.width / 16}rem`, maxWidth: "none" }}
      >
        <defs>
          <marker
            id="map-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" className="fill-line-strong" />
          </marker>
        </defs>
        {layout.links.map(({ edge, path, labelX, labelY }) => (
          <g key={`${edge.from}->${edge.to}`}>
            <title>
              {`${edge.from} → ${edge.to}: ${edge.calls} calls, ${pct(edge.errorRate)} errors, avg ${ms(edge.avgMs)}, last seen ${formatRelativeTime(edge.lastSeen)}${edge.confidence === "parent_child" ? " (inferred from parent and child spans)" : ""}`}
            </title>
            <path
              d={path}
              fill="none"
              markerEnd="url(#map-arrow)"
              strokeDasharray={edge.confidence === "parent_child" ? "4 3" : undefined}
              className={cn(
                "stroke-[1.5]",
                edge.errors > 0 ? "stroke-danger" : "stroke-line-strong"
              )}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[0.625rem]"
            >
              {edge.calls.toLocaleString()} · {pct(edge.errorRate)}
            </text>
          </g>
        ))}
        {layout.nodes.map((node) => {
          const stats = red.get(node.id)
          const failing = Boolean(stats && stats.errorRate > 0.05)
          return (
            <g key={node.id} transform={`translate(${node.x},${node.y})`}>
              <title>{node.id}</title>
              <rect
                width={w}
                height={h}
                rx={6}
                className={cn(
                  "fill-panel stroke-[1.5]",
                  failing ? "stroke-danger" : "stroke-line-strong"
                )}
              />
              <text x={10} y={22} className="fill-text text-[0.8125rem] font-semibold">
                {node.id.length > 22 ? `${node.id.slice(0, 21)}…` : node.id}
              </text>
              <text x={10} y={42} className="fill-muted-foreground font-mono text-[0.625rem]">
                {stats
                  ? `${stats.ratePerMin.toFixed(1)}/min · ${pct(stats.errorRate)} err · p95 ${ms(stats.p95)}`
                  : "no spans in window"}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
