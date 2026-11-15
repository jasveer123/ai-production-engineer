import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { formatRelativeTime } from "@/lib/format/relative-time"
import type { ServiceRed } from "../schemas"

interface ServiceRedTableProps {
  services: ServiceRed[]
}

const ms = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(1)} ms`

export function ServiceRedTable({ services }: ServiceRedTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Service</TableHead>
          <TableHead>Requests / min</TableHead>
          <TableHead>Error rate</TableHead>
          <TableHead>p50</TableHead>
          <TableHead>p95</TableHead>
          <TableHead>Last span</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {services.map((service) => (
          <TableRow key={service.service}>
            <TableCell className="font-medium">
              <Link
                className="hover:underline"
                href={`${ROUTES.exploreTraces}?q=${encodeURIComponent(`service:${service.service}`)}`}
              >
                {service.service}
              </Link>
            </TableCell>
            <TableCell className="font-mono">{service.ratePerMin.toFixed(2)}</TableCell>
            <TableCell className={service.errors > 0 ? "font-mono text-danger" : "font-mono"}>
              {(service.errorRate * 100).toFixed(1)}%
            </TableCell>
            <TableCell className="font-mono">{ms(service.p50)}</TableCell>
            <TableCell className="font-mono">{ms(service.p95)}</TableCell>
            <TableCell className="font-mono">{formatRelativeTime(service.lastSeen)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
