import { MAP_NODE } from "../constants"
import type { ServiceEdge } from "../schemas"

export interface MapNode {
  id: string
  x: number
  y: number
}

export interface MapLink {
  edge: ServiceEdge
  path: string
  labelX: number
  labelY: number
}

export interface MapLayout {
  nodes: MapNode[]
  links: MapLink[]
  width: number
  height: number
}

function depths(ids: string[], edges: ServiceEdge[]): Map<string, number> {
  const depth = new Map(ids.map((id) => [id, 0]))
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false
    for (const edge of edges) {
      const next = (depth.get(edge.from) ?? 0) + 1
      if (next > (depth.get(edge.to) ?? 0) && next < ids.length) {
        depth.set(edge.to, next)
        changed = true
      }
    }
    if (!changed) break
  }
  return depth
}

export function layoutMap(services: string[], edges: ServiceEdge[]): MapLayout {
  const ids = [...new Set([...services, ...edges.flatMap((edge) => [edge.from, edge.to])])].sort()
  const depth = depths(ids, edges)
  const columns = new Map<number, string[]>()
  for (const id of ids) columns.set(depth.get(id)!, [...(columns.get(depth.get(id)!) ?? []), id])

  const { width: w, height: h, columnGap, rowGap, pad } = MAP_NODE
  const positions = new Map<string, MapNode>()
  for (const [column, members] of columns)
    members.forEach((id, row) =>
      positions.set(id, { id, x: pad + column * (w + columnGap), y: pad + row * (h + rowGap) })
    )

  const links = edges.flatMap((edge) => {
    const a = positions.get(edge.from)
    const b = positions.get(edge.to)
    if (!a || !b) return []
    const forward = b.x > a.x
    const x1 = forward ? a.x + w : a.x + w / 2
    const y1 = forward ? a.y + h / 2 : a.y + h
    const x2 = forward ? b.x : b.x + w / 2
    const y2 = forward ? b.y + h / 2 : b.y + h
    const bend = forward ? (x2 - x1) / 2 : rowGap + h / 2
    const path = forward
      ? `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`
      : `M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 + bend} ${x2},${y2}`
    return [{ edge, path, labelX: (x1 + x2) / 2, labelY: (y1 + y2) / 2 - 6 }]
  })

  const nodes = [...positions.values()]
  return {
    nodes,
    links,
    width: Math.max(...nodes.map((n) => n.x + w), w) + pad,
    height: Math.max(...nodes.map((n) => n.y + h), h) + pad + rowGap,
  }
}
