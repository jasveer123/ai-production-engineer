"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Badge, Button, Eyebrow, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { INTEGRATIONS, type IntegrationDefinition } from "../catalog"
import { SNIPPET_DEFAULTS, type IntegrationId } from "../constants"
import { useSiteOrigin } from "../hooks"
import { buildSnippetContext } from "../lib"
import { CheckList } from "./check-list"
import { FactsList } from "./facts-list"
import { RelatedChips } from "./related-chips"
import { StepList } from "./step-list"
import { TroubleshootList } from "./troubleshoot-list"

interface IntegrationDocsPageProps {
  id: IntegrationId
}

export function IntegrationDocsPage({ id }: IntegrationDocsPageProps) {
  const webUrl = useSiteOrigin()
  const definition = INTEGRATIONS.find((item) => item.id === id)!
  const Icon = definition.icon
  const context = buildSnippetContext({
    webUrl,
    ingestUrl: SNIPPET_DEFAULTS.INGEST_URL_PLACEHOLDER,
    token: null,
  })
  const related = definition.related
    .map((relatedId) => INTEGRATIONS.find((item) => item.id === relatedId))
    .filter((item): item is IntegrationDefinition => Boolean(item))

  return (
    <article className="grid max-w-3xl gap-8" aria-label={`${definition.name} guide`}>
      <header className="grid gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center border border-line-strong bg-panel-2 text-brand">
            <Icon className="size-8" />
          </span>
          <div className="grid min-w-0 gap-1">
            <Eyebrow>Integration guide</Eyebrow>
            <h1 className="font-heading text-[1.75rem] leading-[2.125rem] font-semibold tracking-tight">
              {definition.name}
            </h1>
            <span className="text-sm text-muted-foreground">{definition.tagline}</span>
          </div>
        </div>
        <div>
          <Badge>{definition.codeChange ? "Adds a package" : "No code changes"}</Badge>
        </div>
        <p className="text-sm leading-6">{definition.description}</p>
      </header>
      <section className="grid gap-6 border border-line bg-panel p-5 md:grid-cols-2">
        <FactsList facts={definition.facts} />
        <CheckList title="What it collects" items={definition.collects} />
      </section>
      <section className="grid gap-2 border border-line bg-panel-2 p-5" aria-labelledby="before">
        <h2 id="before" className="font-heading text-base font-semibold">
          Before you start
        </h2>
        <p className="text-[0.8125rem] leading-5 text-muted-foreground">
          Copy your ingest URL and token from the {definition.name} page in the app, then paste them
          wherever a step shows{" "}
          <code className="font-mono">{SNIPPET_DEFAULTS.TOKEN_PLACEHOLDER}</code> or{" "}
          <code className="font-mono">{SNIPPET_DEFAULTS.INGEST_URL_PLACEHOLDER}</code>.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-1 w-fit"
          nativeButton={false}
          render={<Link href={ROUTES.integrationDetail(definition.id)} />}
        >
          Open {definition.name} in the app
        </Button>
      </section>
      <section className="grid gap-5" aria-labelledby="steps-title">
        <h2 id="steps-title" className="font-heading text-xl font-semibold">
          Setup steps
        </h2>
        <Tabs defaultValue={definition.methods[0]!.id}>
          <TabsList className="h-auto w-full flex-wrap">
            {definition.methods.map((method) => (
              <TabsTrigger key={method.id} value={method.id} className="py-1.5">
                {method.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {definition.methods.map((method) => (
            <TabsContent key={method.id} value={method.id} className="grid gap-4 pt-4">
              <p className="text-[0.8125rem] leading-5 text-muted-foreground">{method.summary}</p>
              <StepList steps={method.steps(context)} startAt={1} />
              <TroubleshootList items={method.troubleshoot} />
            </TabsContent>
          ))}
        </Tabs>
      </section>
      {definition.docsUrl && (
        <Button
          variant="outline"
          className="w-fit"
          nativeButton={false}
          render={<a href={definition.docsUrl} target="_blank" rel="noreferrer" />}
        >
          Read the upstream docs <ExternalLink />
        </Button>
      )}
      <RelatedChips related={related} href={ROUTES.integrationDocs} />
    </article>
  )
}
