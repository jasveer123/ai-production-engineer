import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui"
import type { ServiceRowData } from "../lib"
import { ServiceRow } from "./service-row"

interface ServicesTableProps {
  workspaceId: string
  rows: ServiceRowData[]
  canManage: boolean
}

export function ServicesTable({ workspaceId, rows, canManage }: ServicesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Service</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Logs, 24h</TableHead>
          <TableHead>Errors</TableHead>
          <TableHead>Problem</TableHead>
          <TableHead>Value per request</TableHead>
          <TableHead>Impact, 7 days</TableHead>
          <TableHead>Last log</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <ServiceRow key={row.key} workspaceId={workspaceId} row={row} canManage={canManage} />
        ))}
      </TableBody>
    </Table>
  )
}
