import Link from "next/link"
import { Eyebrow } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import {
  COLLECTOR_COLLECTS,
  COLLECTOR_LIMITS,
  COLLECTOR_TROUBLESHOOT,
  collectorDockerSteps,
  collectorKubernetesSteps,
} from "../catalog"
import { COLLECTOR, INTEGRATION_ID, SNIPPET_DEFAULTS } from "../constants"
import { buildSnippetContext } from "../lib"
import { CheckList } from "./check-list"
import { StepList } from "./step-list"
import { TroubleshootList } from "./troubleshoot-list"

const PLATFORMS = [
  {
    id: COLLECTOR.ANCHOR.DOCKER,
    label: "Docker",
    steps: collectorDockerSteps,
    troubleshoot: COLLECTOR_TROUBLESHOOT.docker,
    integration: INTEGRATION_ID.DOCKER,
  },
  {
    id: COLLECTOR.ANCHOR.KUBERNETES,
    label: "Kubernetes",
    steps: collectorKubernetesSteps,
    troubleshoot: COLLECTOR_TROUBLESHOOT.kubernetes,
    integration: INTEGRATION_ID.KUBERNETES,
  },
]

export function CollectorDocsPage() {
  const context = buildSnippetContext({
    webUrl: SNIPPET_DEFAULTS.WEB_URL_PLACEHOLDER,
    ingestUrl: SNIPPET_DEFAULTS.INGEST_URL_PLACEHOLDER,
    token: null,
  })

  return (
    <article className="grid max-w-3xl gap-8" aria-label={`${COLLECTOR.NAME} guide`}>
      <header className="grid gap-3">
        <Eyebrow>Guide</Eyebrow>
        <h1 className="font-heading text-[1.75rem] leading-[2.125rem] font-semibold tracking-tight">
          {COLLECTOR.NAME}
        </h1>
        <p className="text-sm leading-6">
          The collector runs next to your apps, reads their logs from the outside and sends them to
          Pramaan with your token. Your apps and images stay as they are.
        </p>
      </header>
      <section className="grid gap-6 border border-line bg-panel p-5 md:grid-cols-2">
        <CheckList title="What it collects" items={COLLECTOR_COLLECTS} />
        <CheckList title="Good to know" items={COLLECTOR_LIMITS} />
      </section>
      <section className="grid gap-2 border border-line bg-panel-2 p-5">
        <h2 className="font-heading text-base font-semibold">Before you start</h2>
        <p className="text-[0.8125rem] leading-5 text-muted-foreground">
          Copy your ingest URL and token from your integration page in the app, then paste them
          wherever a step shows{" "}
          <code className="font-mono">{SNIPPET_DEFAULTS.TOKEN_PLACEHOLDER}</code> or{" "}
          <code className="font-mono">{SNIPPET_DEFAULTS.INGEST_URL_PLACEHOLDER}</code>.
        </p>
      </section>
      {PLATFORMS.map((platform) => (
        <section
          key={platform.id}
          id={platform.id}
          className="grid scroll-mt-24 gap-4"
          aria-labelledby={`${platform.id}-title`}
        >
          <h2 id={`${platform.id}-title`} className="font-heading text-xl font-semibold">
            {platform.label}
          </h2>
          <StepList steps={platform.steps(context)} startAt={1} />
          <TroubleshootList items={platform.troubleshoot} />
          <Link
            href={ROUTES.integrationDocs(platform.integration)}
            className="w-fit text-sm text-brand underline underline-offset-3 hover:text-brand-strong"
          >
            Other ways to collect from {platform.label}
          </Link>
        </section>
      ))}
    </article>
  )
}
