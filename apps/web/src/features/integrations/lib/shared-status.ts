import type { IntegrationDefinition } from "../catalog"

export function getSharedWith(
  definition: IntegrationDefinition,
  all: IntegrationDefinition[]
): IntegrationDefinition[] {
  return all.filter((item) => item.way === definition.way && item.id !== definition.id)
}

export function getStatusGroups(all: IntegrationDefinition[]): IntegrationDefinition[][] {
  const byWay = new Map<string, IntegrationDefinition[]>()
  all.forEach((item) => byWay.set(item.way, [...(byWay.get(item.way) ?? []), item]))
  return [...byWay.values()].filter((group) => group.length > 1)
}
