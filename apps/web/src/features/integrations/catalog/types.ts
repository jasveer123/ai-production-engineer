import type * as React from "react"
import type { IntegrationGroup, IntegrationId } from "../constants"
import type { IngestWay } from "../schemas"

export type IntegrationIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>

export interface SnippetContext {
  webUrl: string
  ingestUrl: string
  containerIngestUrl: string
  token: string
  service: string
  environment: string
}

export interface StepCode {
  filename?: string
  content: string
}

export interface IntegrationStep {
  title: string
  description?: string
  code?: StepCode
}

export interface IntegrationMethod {
  id: string
  label: string
  summary: string
  steps: (context: SnippetContext) => IntegrationStep[]
  troubleshoot: string[]
}

export interface IntegrationFacts {
  access: string
  limits: string
}

export interface IntegrationDefinition {
  id: IntegrationId
  name: string
  tagline: string
  description: string
  group: IntegrationGroup
  way: IngestWay
  icon: IntegrationIcon
  codeChange: boolean
  facts: IntegrationFacts
  collects: string[]
  docsUrl?: string
  related: IntegrationId[]
  methods: IntegrationMethod[]
}
