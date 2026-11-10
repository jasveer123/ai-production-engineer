"use client"

import * as React from "react"
import { Chip, Separator, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { Row, Section } from "../components"

const FILTERS = ["All", "Log sources", "Alerts in", "Notify and chat", "Code and tickets"]

export function TabsChipsSection() {
  const [filter, setFilter] = React.useState(FILTERS[0])

  return (
    <Section id="tabs-chips" title="Tabs and filter chips">
      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="fixes">Fixes</TabsTrigger>
        </TabsList>
        <TabsContent value="logs" className="pt-3 text-muted-foreground">
          312 logs a minute from 3 sources.
        </TabsContent>
        <TabsContent value="alerts" className="pt-3 text-muted-foreground">
          2 alert rules are active.
        </TabsContent>
        <TabsContent value="fixes" className="pt-3 text-muted-foreground">
          1 fix is waiting for you.
        </TabsContent>
      </Tabs>
      <Separator />
      <Row>
        {FILTERS.map((item) => (
          <Chip key={item} selected={filter === item} onClick={() => setFilter(item)}>
            {item}
          </Chip>
        ))}
      </Row>
    </Section>
  )
}
