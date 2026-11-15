import { PERSON_COLORS } from "../constants"
import type { Person } from "../schemas"

export const displayName = (person: Person) => person.name ?? person.email

export function initials(person: Person): string {
  const parts = displayName(person)
    .split(/[\s@.]+/)
    .filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

export const colorFor = (index: number) => PERSON_COLORS[index % PERSON_COLORS.length]!

export function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export const fromLocalInput = (value: string) => new Date(value).toISOString()

export function timeLeft(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} h ${minutes % 60} min`
  return `${Math.floor(hours / 24)} days`
}
