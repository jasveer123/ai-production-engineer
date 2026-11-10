import { Search } from "lucide-react"
import { Chip, Eyebrow, Input } from "@/components/ui"
import type { IntegrationDefinition } from "../catalog"
import {
  INTEGRATION_GROUP,
  INTEGRATION_GROUP_BLURB,
  INTEGRATION_GROUP_LABEL,
  type IntegrationGroup,
} from "../constants"
import type { IngestOverview, StreamState } from "../schemas"
import { IntegrationTile } from "./integration-tile"
import { SharedStatusNote } from "./shared-status-note"

export type GroupFilter = IntegrationGroup | "all"

const GROUPS: IntegrationGroup[] = [INTEGRATION_GROUP.COLLECT, INTEGRATION_GROUP.CODE]

interface CatalogueProps {
  all: IntegrationDefinition[]
  visible: IntegrationDefinition[]
  overview: IngestOverview | undefined
  group: GroupFilter
  search: string
  onGroupChange: (group: GroupFilter) => void
  onSearchChange: (search: string) => void
}

const stateOf = (overview: IngestOverview | undefined, way: string): StreamState =>
  overview?.ways.find((item) => item.way === way)?.state ?? "not_set_up"

export function Catalogue({
  all,
  visible,
  overview,
  group,
  search,
  onGroupChange,
  onSearchChange,
}: CatalogueProps) {
  const countOf = (value: GroupFilter) =>
    value === "all" ? all.length : all.filter((item) => item.group === value).length

  return (
    <section className="grid gap-4" aria-labelledby="catalogue-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="catalogue-title" className="font-heading text-xl font-semibold">
          Catalogue
        </h2>
        <span className="font-mono text-[0.8125rem] text-muted-foreground">
          {all.length} integrations
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search integrations"
            placeholder={`Search ${all.length} integrations`}
            className="pl-9"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
          {(["all", ...GROUPS] as GroupFilter[]).map((value) => (
            <Chip key={value} selected={group === value} onClick={() => onGroupChange(value)}>
              {value === "all" ? "All" : INTEGRATION_GROUP_LABEL[value]}{" "}
              <span className="text-muted-foreground">{countOf(value)}</span>
            </Chip>
          ))}
        </div>
      </div>
      {visible.length === 0 && (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          Nothing matches that search. Try a shorter word.
        </p>
      )}
      {GROUPS.map((value) => {
        const items = visible.filter((item) => item.group === value)
        if (items.length === 0) return null

        return (
          <div key={value} className="grid gap-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <Eyebrow className="text-[0.75rem]">{INTEGRATION_GROUP_LABEL[value]}</Eyebrow>
              <span className="text-[0.8125rem] text-muted-foreground">
                {INTEGRATION_GROUP_BLURB[value]}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <IntegrationTile
                  key={item.id}
                  definition={item}
                  state={stateOf(overview, item.way)}
                />
              ))}
            </div>
          </div>
        )
      })}
      <SharedStatusNote definitions={all} />
    </section>
  )
}
