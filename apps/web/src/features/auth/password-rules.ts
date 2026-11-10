import { PASSWORD_MIN } from "./schemas"

export const PASSWORD_RULES = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN} characters`,
    test: (v: string) => v.length >= PASSWORD_MIN,
  },
  {
    id: "case",
    label: "Upper and lower case letters",
    test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v),
  },
  { id: "number", label: "A number", test: (v: string) => /\d/.test(v) },
  {
    id: "symbol",
    label: "A symbol or a long phrase",
    test: (v: string) => /[^A-Za-z0-9]/.test(v) || v.length >= 20,
  },
] as const

export const passwordScore = (v: string) => PASSWORD_RULES.filter((r) => r.test(v)).length
