import Link from "next/link"
import { Badge, Status, TableCell, TableRow } from "@/components/ui"
import { MiniBars } from "@/components/shared"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import type { ServiceRowData } from "../lib"
import { SetValueDialog } from "./set-value-dialog"

const STATUS_STATE = { receiving: "live", quiet: "waiting", problem: "failed" } as const
const STATUS_LABEL = { receiving: "Receiving", quiet: "Quiet", problem: "Problem" } as const

const money = (amount: number, currency: string | null) =>
  new Intl.NumberFormat([], {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 2,
  }).format(amount)

interface ServiceRowProps {
  workspaceId: string
  row: ServiceRowData
  canManage: boolean
}

export function ServiceRow({ workspaceId, row, canManage }: ServiceRowProps) {
  return (
    <TableRow>
      <TableCell>
        <Link
          href={ROUTES.liveTailFor(row.name)}
          className="grid gap-0.5 outline-none hover:text-brand focus-visible:text-brand"
        >
          <span className="font-medium">{row.name}</span>
          <span className="font-mono text-[0.6875rem] text-muted-foreground">
            {row.environment}
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <Status state={STATUS_STATE[row.status]}>{STATUS_LABEL[row.status]}</Status>
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-3">
          <MiniBars values={row.buckets} tone={row.errors > 0 ? "danger" : "brand"} />
          <span className="font-mono text-[0.8125rem]">{row.total.toLocaleString()}</span>
        </span>
      </TableCell>
      <TableCell
        className={`font-mono ${row.errors > 0 ? "text-danger" : "text-muted-foreground"}`}
      >
        {row.errors.toLocaleString()}
      </TableCell>
      <TableCell>
        {row.problems.length > 0 ? (
          <Badge variant="destructive" title={row.problems.join("\n")}>
            {row.problems.length === 1 ? row.problems[0] : `${row.problems.length} problems`}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground">
            {row.valuePerRequest === null ? "-" : money(row.valuePerRequest, row.currency)}
          </span>
          {canManage && <SetValueDialog workspaceId={workspaceId} row={row} />}
        </span>
      </TableCell>
      <TableCell className="font-mono text-muted-foreground">
        {row.impact === null ? "-" : money(row.impact, row.currency)}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatRelativeTime(row.lastAt)}</TableCell>
    </TableRow>
  )
}
