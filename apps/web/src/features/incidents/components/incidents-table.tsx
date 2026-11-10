import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui"
import type { Incident } from "../schemas"
import { IncidentRow } from "./incident-row"

interface IncidentsTableProps {
  incidents: Incident[]
}

export function IncidentsTable({ incidents }: IncidentsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Incident</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Service</TableHead>
          <TableHead>Events</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Last seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {incidents.map((incident) => (
          <IncidentRow key={incident.id} incident={incident} />
        ))}
      </TableBody>
    </Table>
  )
}
