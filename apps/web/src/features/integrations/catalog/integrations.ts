import { docker } from "./definitions/docker"
import { fluentBit } from "./definitions/fluent-bit"
import { javascript } from "./definitions/javascript"
import { kubernetes } from "./definitions/kubernetes"
import { opentelemetry } from "./definitions/opentelemetry"
import { python } from "./definitions/python"
import { vector } from "./definitions/vector"
import type { IntegrationDefinition } from "./types"

export const INTEGRATIONS: IntegrationDefinition[] = [
  opentelemetry,
  docker,
  kubernetes,
  vector,
  fluentBit,
  javascript,
  python,
]
