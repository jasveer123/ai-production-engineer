import OpentelemetryLogo from "@/assets/svg/opentelemetry.svg"
import { INGEST_ENDPOINTS } from "@/lib/api/endpoints"
import { INTEGRATION_GROUP, INTEGRATION_ID } from "../../constants"
import type { IntegrationDefinition, SnippetContext } from "../types"

const TRACES_PATH = "/v1/traces"
const METRICS_PATH = "/v1/metrics"
const WAY_QUERY = "way=otlp"
const TOKEN_HEADER = "x-ape-token"

const endpoints = (context: SnippetContext) => {
  const base = context.containerIngestUrl
  return [
    `logs_endpoint: ${base}${INGEST_ENDPOINTS.SEND_LOGS}?${WAY_QUERY}`,
    `traces_endpoint: ${base}${TRACES_PATH}?${WAY_QUERY}`,
    `metrics_endpoint: ${base}${METRICS_PATH}?${WAY_QUERY}`,
  ]
}

const COLLECTOR_CHECKS = [
  "Run docker logs pramaan-otel and look for lines saying Exporting failed.",
  "If the container cannot reach us, change host.docker.internal to an address it can reach.",
  "Your app must send to the Collector's address (port 4318), not straight to us, in this method.",
]

export const opentelemetry: IntegrationDefinition = {
  id: INTEGRATION_ID.OPENTELEMETRY,
  name: "OpenTelemetry",
  tagline: "Collector or any app SDK",
  description:
    "The open standard for logs, traces and metrics. Run the Collector next to your apps, or point an OpenTelemetry exporter straight at us.",
  group: INTEGRATION_GROUP.COLLECT,
  way: "otlp",
  icon: OpentelemetryLogo,
  codeChange: false,
  facts: {
    access:
      "Read access to any log files you list. Network access from the Collector or your app to our intake address.",
    limits:
      "Up to 10 MB per request (gzip is accepted), and logs are kept 7 days by default. Metrics are accepted and counted, not stored.",
  },
  collects: [
    "Logs from OTLP and from log files you list",
    "Traces, stored so the AI can read a whole request",
    "Metrics, accepted and counted",
  ],
  docsUrl: "https://opentelemetry.io/docs/collector/",
  related: [INTEGRATION_ID.JAVASCRIPT, INTEGRATION_ID.PYTHON],
  methods: [
    {
      id: "docker",
      label: "Collector in Docker",
      summary: "Run the Collector as a container next to your apps.",
      troubleshoot: COLLECTOR_CHECKS,
      steps: (context) => [
        {
          title: "Save this Collector config",
          description: "It reads files and OTLP from your apps, then sends everything to us.",
          code: {
            filename: "otel-collector.yaml",
            content: [
              "receivers:",
              "  otlp:",
              "    protocols:",
              "      grpc:",
              "        endpoint: 0.0.0.0:4317",
              "      http:",
              "        endpoint: 0.0.0.0:4318",
              "  filelog:",
              "    include:",
              "      - /var/log/app/*.log",
              "processors:",
              "  resource:",
              "    attributes:",
              "      - key: service.name",
              `        value: ${context.service}`,
              "        action: insert",
              "      - key: deployment.environment",
              `        value: ${context.environment}`,
              "        action: insert",
              "exporters:",
              "  otlphttp:",
              ...endpoints(context).map((line) => `    ${line}`),
              "    headers:",
              `      ${TOKEN_HEADER}: ${context.token}`,
              "service:",
              "  pipelines:",
              "    logs:",
              "      receivers: [otlp, filelog]",
              "      processors: [resource]",
              "      exporters: [otlphttp]",
              "    traces:",
              "      receivers: [otlp]",
              "      processors: [resource]",
              "      exporters: [otlphttp]",
              "    metrics:",
              "      receivers: [otlp]",
              "      processors: [resource]",
              "      exporters: [otlphttp]",
            ].join("\n"),
          },
        },
        {
          title: "Run the Collector",
          description: "Use the contrib build, which includes the file reader.",
          code: {
            filename: "terminal",
            content: [
              "docker run -d --name pramaan-otel \\",
              "  -p 4317:4317 -p 4318:4318 \\",
              "  -v $PWD/otel-collector.yaml:/etc/otelcol-contrib/config.yaml:ro \\",
              "  -v /var/log/app:/var/log/app:ro \\",
              "  otel/opentelemetry-collector-contrib:latest",
            ].join("\n"),
          },
        },
        {
          title: "Point your apps at the Collector",
          description: "Any OpenTelemetry SDK can use these settings.",
          code: {
            filename: "terminal",
            content: [
              'export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"',
              `export OTEL_SERVICE_NAME="${context.service}"`,
            ].join("\n"),
          },
        },
      ],
    },
    {
      id: "existing",
      label: "Collector you already run",
      summary: "Add an exporter and three pipelines to your own config.",
      troubleshoot: [
        "Restart the Collector after you edit its config.",
        "Check the Collector's own log output for lines saying Exporting failed.",
        "Make sure your existing receivers are named in the receivers lists below.",
      ],
      steps: (context) => [
        {
          title: "Add this to your Collector config",
          description:
            "Keep everything you already have. Change the receivers lists if yours are named differently.",
          code: {
            filename: "config.yaml",
            content: [
              "exporters:",
              "  otlphttp/pramaan:",
              ...endpoints(context).map((line) => `    ${line}`),
              "    headers:",
              `      ${TOKEN_HEADER}: ${context.token}`,
              "processors:",
              "  batch:",
              "service:",
              "  pipelines:",
              "    logs/pramaan:",
              "      receivers: [otlp]",
              "      processors: [batch]",
              "      exporters: [otlphttp/pramaan]",
              "    traces/pramaan:",
              "      receivers: [otlp]",
              "      processors: [batch]",
              "      exporters: [otlphttp/pramaan]",
              "    metrics/pramaan:",
              "      receivers: [otlp]",
              "      processors: [batch]",
              "      exporters: [otlphttp/pramaan]",
            ].join("\n"),
          },
        },
        {
          title: "Restart the Collector",
          description: "For a systemd install. In Docker, restart the container instead.",
          code: { filename: "terminal", content: "sudo systemctl restart otelcol-contrib" },
        },
      ],
    },
    {
      id: "sdk",
      label: "Straight from your app",
      summary: "No Collector. Your app's OpenTelemetry SDK sends to us.",
      troubleshoot: [
        "Check the header name is exactly x-ape-token and the token has no extra spaces.",
        "Spans are sent in batches. Shut the tracer provider down before a script exits.",
        "OTLP over HTTP is supported. gRPC is not.",
      ],
      steps: (context) => [
        {
          title: "Set the three standard settings",
          description: "Most OpenTelemetry SDKs read these from the environment.",
          code: {
            filename: "terminal",
            content: [
              `export OTEL_EXPORTER_OTLP_ENDPOINT="${context.ingestUrl}"`,
              `export OTEL_EXPORTER_OTLP_HEADERS="${TOKEN_HEADER}=${context.token}"`,
              `export OTEL_SERVICE_NAME="${context.service}"`,
            ].join("\n"),
          },
        },
        {
          title: "Python example",
          description: "Install the SDK and the HTTP exporter, then run this.",
          code: {
            filename: "otel_example.py",
            content: [
              "from opentelemetry import trace",
              "from opentelemetry.sdk.resources import Resource",
              "from opentelemetry.sdk.trace import TracerProvider",
              "from opentelemetry.sdk.trace.export import BatchSpanProcessor",
              "from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter",
              "",
              "provider = TracerProvider(resource=Resource.create({'service.name': 'my-app'}))",
              "provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(",
              `    endpoint='${context.ingestUrl}${TRACES_PATH}',`,
              `    headers={'${TOKEN_HEADER}': '${context.token}'},`,
              ")))",
              "trace.set_tracer_provider(provider)",
              "",
              "with trace.get_tracer('my-app').start_as_current_span('checkout'):",
              "    print('working')",
              "provider.shutdown()",
            ].join("\n"),
          },
        },
        {
          title: "Install the Python packages",
          code: {
            filename: "terminal",
            content: "pip install opentelemetry-sdk opentelemetry-exporter-otlp-proto-http",
          },
        },
      ],
    },
  ],
}
