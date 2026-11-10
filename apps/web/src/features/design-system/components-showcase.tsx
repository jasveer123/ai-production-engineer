import { ThemeToggle } from "@/components/shared"
import { Eyebrow, Tag } from "@/components/ui"
import {
  AlertsSection,
  BadgesSection,
  ButtonsSection,
  CardsSection,
  ChoicesSection,
  ColorsSection,
  FeedbackSection,
  FormsSection,
  OverlaysSection,
  TableSection,
  TabsChipsSection,
  TraceSection,
} from "./sections"

const NAV = [
  "buttons",
  "badges",
  "forms",
  "choices",
  "tabs-chips",
  "cards",
  "alerts",
  "trace",
  "table",
  "overlays",
  "feedback",
  "colors",
]

export function ComponentsShowcase() {
  return (
    <div className="stage min-h-screen">
      <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-line bg-panel/90 px-6 py-3 backdrop-blur">
        <span className="font-heading text-lg font-semibold tracking-tight text-brand">
          Pramaan
        </span>
        <Tag>Components</Tag>
        <nav className="ml-4 hidden gap-1 lg:flex" aria-label="Sections">
          {NAV.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              className="px-2 py-1 text-[0.8125rem] text-muted-foreground outline-none hover:text-text focus-visible:ring-3 focus-visible:ring-brand/40"
            >
              {id}
            </a>
          ))}
        </nav>
        <ThemeToggle className="ml-auto" />
      </header>
      <main className="mx-auto grid max-w-5xl gap-12 px-6 py-12">
        <div className="grid gap-3">
          <Eyebrow>Design system</Eyebrow>
          <h1 className="font-heading text-4xl font-bold tracking-tight">
            Every component, in both themes
          </h1>
          <p className="max-w-[60ch] text-muted-foreground">
            Hover, focus (use Tab), press and disable states are live. Switch Night and Day at the
            top right.
          </p>
        </div>
        <ButtonsSection />
        <BadgesSection />
        <FormsSection />
        <ChoicesSection />
        <TabsChipsSection />
        <CardsSection />
        <AlertsSection />
        <TraceSection />
        <TableSection />
        <OverlaysSection />
        <FeedbackSection />
        <ColorsSection />
      </main>
    </div>
  )
}
