import Link from "next/link"
import { Status } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import type { IntegrationDefinition } from "../catalog"
import { STATE_LABEL } from "../constants"
import type { StreamState } from "../schemas"

const DOT_STATE = { receiving: "live", silent: "waiting", not_set_up: "idle" } as const

interface IntegrationTileProps {
  definition: IntegrationDefinition
  state: StreamState
}

export function IntegrationTile({ definition, state }: IntegrationTileProps) {
  const Icon = definition.icon

  return (
    <Link
      href={ROUTES.integrationDetail(definition.id)}
      className="flex cursor-pointer items-center gap-3 border border-line bg-panel p-4 text-left transition-[transform,border-color,box-shadow] duration-200 ease-out outline-none hover:-translate-y-0.5 hover:border-line-strong focus-visible:ring-3 focus-visible:ring-brand/40"
    >
      <span className="grid size-11 shrink-0 place-items-center border border-line-strong bg-panel-2 text-brand">
        <Icon className="size-6" />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-heading text-[0.9375rem] leading-snug font-semibold">
          {definition.name}
        </span>
        <span className="truncate text-[0.8125rem] leading-5 text-muted-foreground">
          {definition.tagline}
        </span>
      </span>
      <Status state={DOT_STATE[state]}>
        <span className="sr-only">{STATE_LABEL[state]}</span>
      </Status>
    </Link>
  )
}
