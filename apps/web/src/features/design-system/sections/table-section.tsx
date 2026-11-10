import {
  CodeBlock,
  Status,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { Section } from "../components"

type SourceState = "live" | "waiting" | "failed"

interface SourceRow {
  name: string
  rate: string
  state: SourceState
}

const SOURCES: SourceRow[] = [
  { name: "Collector", rate: "188 /min", state: "live" },
  { name: "OpenTelemetry", rate: "96 /min", state: "live" },
  { name: "AWS CloudWatch", rate: "0 /min", state: "waiting" },
  { name: "Microsoft Teams", rate: "-", state: "failed" },
]

const SNIPPET = `pip install pramaan-logs

import pramaan
pramaan.init(token="prm_live_…")`

export function TableSection() {
  return (
    <Section id="table" title="Table and code">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SOURCES.map((source) => (
            <TableRow key={source.name}>
              <TableCell className="font-medium">{source.name}</TableCell>
              <TableCell className="font-mono text-muted-foreground">{source.rate}</TableCell>
              <TableCell>
                <Status state={source.state}>{source.state}</Status>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CodeBlock>{SNIPPET}</CodeBlock>
    </Section>
  )
}
