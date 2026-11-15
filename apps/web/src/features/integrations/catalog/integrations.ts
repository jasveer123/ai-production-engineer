import { aws } from "./definitions/aws"
import { docker } from "./definitions/docker"
import { fluentBit } from "./definitions/fluent-bit"
import { http } from "./definitions/http"
import { javascript } from "./definitions/javascript"
import { kubernetes } from "./definitions/kubernetes"
import { opentelemetry } from "./definitions/opentelemetry"
import { python } from "./definitions/python"
import { ubuntu } from "./definitions/ubuntu"
import { vector } from "./definitions/vector"
import type { IntegrationDefinition } from "./types"

export const INTEGRATIONS: IntegrationDefinition[] = [
  opentelemetry,
  docker,
  kubernetes,
  ubuntu,
  aws,
  vector,
  fluentBit,
  javascript,
  python,
  http,
]
