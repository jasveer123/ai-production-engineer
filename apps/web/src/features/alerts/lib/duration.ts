import { TIME_UNITS } from "../constants"

export function splitSeconds(seconds: number): { amount: number; unit: number } {
  const unit = [...TIME_UNITS].reverse().find((u) => seconds >= u.value && seconds % u.value === 0)
  return { amount: seconds / (unit?.value ?? 1), unit: unit?.value ?? 1 }
}

export function formatSeconds(seconds: number): string {
  const { amount, unit } = splitSeconds(seconds)
  const label = TIME_UNITS.find((u) => u.value === unit)?.label ?? "seconds"
  return `${amount} ${amount === 1 ? label.slice(0, -1) : label}`
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = Math.round(ms / 1000)
  return s < 120 ? `${s} s` : `${Math.round(s / 60)} min`
}
