import type { ResourceDraft, SectionDraft } from "./requests"
import type { Structure } from "./schemas"

let counter = 0
export const newKey = () => `draft-${++counter}`

export const emptyResource = (): ResourceDraft => ({
  key: newKey(),
  publicName: "",
  explanation: "",
  monitorIds: [],
  manualState: "operational",
  showHistory: true,
})

export const toDrafts = (structure: Structure): SectionDraft[] =>
  structure.sections.map((s) => ({
    key: s.id,
    id: s.id,
    name: s.name,
    resources: s.resources.map((r) => ({
      key: r.id,
      id: r.id,
      publicName: r.publicName,
      explanation: r.explanation ?? "",
      monitorIds: r.monitorIds,
      manualState: r.manualState ?? "operational",
      showHistory: r.showHistory,
    })),
  }))

export const toPayload = (sections: SectionDraft[]) => ({
  sections: sections.map((s) => ({
    id: s.id,
    name: s.name.trim(),
    resources: s.resources.map((r) => ({
      id: r.id,
      publicName: r.publicName.trim(),
      explanation: r.explanation.trim() || null,
      monitorIds: r.monitorIds,
      manualState: r.monitorIds.length ? null : r.manualState,
      showHistory: r.showHistory,
    })),
  })),
})

export function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  return next
}
