import { Section } from "../components"

const TOKENS = [
  "bg",
  "panel",
  "panel-2",
  "sunken",
  "line",
  "line-strong",
  "brand",
  "brand-soft",
  "ai",
  "ok",
  "warn",
  "danger",
  "info",
]

export function ColorsSection() {
  return (
    <Section id="colors" title="Color tokens" note="These follow the active theme.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {TOKENS.map((token) => (
          <div key={token} className="grid gap-1.5">
            <div className="h-12 border border-line" style={{ background: `var(--${token})` }} />
            <span className="font-mono text-[0.6875rem] text-muted-foreground">{token}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}
