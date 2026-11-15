import { ROTATION_UNITS, WEEKDAYS } from "../constants"
import type { Layer, LayerRequest, Restriction, Rotation } from "../schemas"

export function describeRotation(rotation: Rotation): string {
  if (rotation.kind === "elapsed") return `Every ${rotation.hours} hours`
  const unit = ROTATION_UNITS.find((u) => u.days === rotation.lengthDays)?.label
  const base = unit ?? `Every ${rotation.lengthDays} days`
  return `${base}, hand over at ${rotation.handoffTime}`
}

export function describeRestriction(r: Restriction): string {
  const days = r.days.length === 7 ? "Every day" : r.days.map((d) => WEEKDAYS[d] ?? d).join(", ")
  return `${days} ${r.start} to ${r.end}`
}

export const todayIn = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(new Date())

export function newLayer(index: number, timeZone: string): LayerRequest {
  return {
    id: `layer-${Date.now().toString(36)}-${index}`,
    name: index === 0 ? "Primary" : `Layer ${index + 1}`,
    rotation: {
      kind: "calendar",
      lengthDays: 7,
      startDate: todayIn(timeZone),
      handoffTime: "09:00",
    },
    participantIds: [],
    restrictions: [],
  }
}

export const layerToRequest = (layer: Layer): LayerRequest => ({
  id: layer.id,
  name: layer.name,
  rotation: layer.rotation,
  participantIds: layer.participants.map((p) => p.userId),
  restrictions: layer.restrictions,
})

export function timeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  const zones = intl.supportedValuesOf?.("timeZone") ?? []
  return zones.includes("UTC") ? zones : ["UTC", ...zones]
}

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
