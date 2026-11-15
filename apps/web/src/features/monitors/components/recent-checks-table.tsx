import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { formatDateTime } from "@/lib/format/relative-time"
import type { Check } from "../schemas"

interface RecentChecksTableProps {
  checks: Check[]
}

function timing(check: Check) {
  const t = check.timings
  if (!t) return ""
  return [
    t.dnsMs !== null && `dns ${t.dnsMs}`,
    t.connectMs !== null && `connect ${t.connectMs}`,
    t.tlsMs !== null && `tls ${t.tlsMs}`,
    t.firstByteMs !== null && `first byte ${t.firstByteMs}`,
  ]
    .filter(Boolean)
    .join(" · ")
}

export function RecentChecksTable({ checks }: RecentChecksTableProps) {
  if (checks.length === 0)
    return <p className="text-sm text-muted-foreground">No check has run yet.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Response</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {checks.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-mono text-[0.75rem] text-muted-foreground">
              {formatDateTime(item.checkedAt)}
            </TableCell>
            <TableCell>
              <span className="flex flex-wrap gap-1">
                <Badge variant={item.ok ? "success" : "destructive"}>
                  {item.ok ? "Passed" : "Failed"}
                </Badge>
                {item.maintenance && <Badge variant="warning">Maintenance</Badge>}
                {item.transition && (
                  <Badge>{item.transition === "down" ? "Incident opened" : "Recovered"}</Badge>
                )}
              </span>
            </TableCell>
            <TableCell className="font-mono text-muted-foreground">
              {item.statusCode ?? "-"}
            </TableCell>
            <TableCell className="font-mono text-muted-foreground">
              <span className="block">{item.responseMs} ms</span>
              <span className="block text-[0.6875rem]">{timing(item)}</span>
            </TableCell>
            <TableCell className="text-[0.75rem] text-muted-foreground">
              {item.region ?? "-"}
            </TableCell>
            <TableCell className="text-danger">{item.error ?? ""}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
