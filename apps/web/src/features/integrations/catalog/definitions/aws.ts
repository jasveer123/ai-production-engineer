import CloudLogo from "@/assets/svg/cloud.svg"
import { INGEST_ENDPOINTS } from "@/lib/api/endpoints"
import { INTEGRATION_GROUP, INTEGRATION_ID } from "../../constants"
import { vectorSink } from "../snippets"
import type { IntegrationDefinition, SnippetContext } from "../types"

const onHost = (context: SnippetContext) => ({ ...context, containerIngestUrl: context.ingestUrl })

const relayConfig = (context: SnippetContext) =>
  [
    "sources:",
    "  firehose:",
    "    type: aws_kinesis_firehose",
    "    address: 0.0.0.0:9000",
    "    access_keys:",
    "      - ${FIREHOSE_ACCESS_KEY}",
    "    record_compression: auto",
    "transforms:",
    "  cloudwatch:",
    "    type: remap",
    "    inputs:",
    "      - firehose",
    "    source: |",
    "      parsed = parse_aws_cloudwatch_log_subscription_message!(.message)",
    "      . = map_values(parsed.log_events) -> |e| {",
    '        { "message": e.message, "timestamp": e.timestamp, "service": parsed.log_group }',
    "      }",
    ...vectorSink(onHost(context), {
      input: "cloudwatch",
      query: `env=${context.environment}&service=aws`,
    }),
  ].join("\n")

const adotConfig = (context: SnippetContext) =>
  [
    "receivers:",
    "  otlp:",
    "    protocols:",
    "      http:",
    "exporters:",
    "  otlphttp:",
    `    logs_endpoint: ${context.ingestUrl}${INGEST_ENDPOINTS.SEND_LOGS}?way=otlp`,
    `    traces_endpoint: ${context.ingestUrl}/v1/traces?way=otlp`,
    `    metrics_endpoint: ${context.ingestUrl}/v1/metrics?way=otlp`,
    "    headers:",
    `      x-ape-token: ${context.token}`,
    "service:",
    "  pipelines:",
    "    logs: { receivers: [otlp], exporters: [otlphttp] }",
    "    traces: { receivers: [otlp], exporters: [otlphttp] }",
    "    metrics: { receivers: [otlp], exporters: [otlphttp] }",
  ].join("\n")

export const aws: IntegrationDefinition = {
  id: INTEGRATION_ID.AWS,
  name: "AWS",
  tagline: "CloudWatch, Lambda and ECS",
  description:
    "Stream CloudWatch log groups through Kinesis Data Firehose to a small Vector relay, or send Lambda and ECS telemetry with the AWS Distro for OpenTelemetry.",
  group: INTEGRATION_GROUP.COLLECT,
  way: "agent",
  icon: CloudLogo,
  codeChange: false,
  facts: {
    access:
      "An IAM role that lets CloudWatch Logs write to Firehose, and a public HTTPS address for the relay.",
    limits: "Up to 10 MB per request, and logs are kept 7 days by default.",
  },
  collects: [
    "Any CloudWatch log group you subscribe, including Lambda, ECS and API Gateway logs",
    "Traces and metrics from the AWS Distro for OpenTelemetry",
  ],
  docsUrl: "https://vector.dev/docs/reference/configuration/sources/aws_kinesis_firehose/",
  related: [INTEGRATION_ID.OPENTELEMETRY, INTEGRATION_ID.VECTOR],
  methods: [
    {
      id: "firehose",
      label: "CloudWatch via Firehose",
      summary: "CloudWatch subscription to Firehose, Firehose to a Vector relay, relay to us.",
      troubleshoot: [
        "Check the Firehose delivery stream's error logs for failed HTTP endpoint deliveries.",
        "The Firehose access key must match FIREHOSE_ACCESS_KEY on the relay.",
        "Run docker logs pramaan-aws-relay and look for errors.",
      ],
      steps: (context) => [
        {
          title: "Save the relay config",
          code: { filename: "vector.yaml", content: relayConfig(context) },
        },
        {
          title: "Run the relay behind HTTPS",
          code: {
            filename: "terminal",
            content: [
              "docker run -d --name pramaan-aws-relay -p 9000:9000 \\",
              "  -e FIREHOSE_ACCESS_KEY=choose-a-long-secret \\",
              "  -v $PWD/vector.yaml:/etc/vector/vector.yaml:ro \\",
              "  timberio/vector:latest-alpine",
            ].join("\n"),
          },
        },
        {
          title: "Point Firehose at the relay and subscribe your log groups",
          description:
            "Create a Firehose stream with an HTTP endpoint destination set to the relay's HTTPS address and the same access key, then add a subscription filter on each log group.",
          code: {
            filename: "terminal",
            content: [
              "aws logs put-subscription-filter \\",
              "  --log-group-name /aws/lambda/my-function \\",
              '  --filter-name pramaan --filter-pattern "" \\',
              "  --destination-arn arn:aws:firehose:REGION:ACCOUNT:deliverystream/pramaan \\",
              "  --role-arn arn:aws:iam::ACCOUNT:role/CWLtoFirehose",
            ].join("\n"),
          },
        },
      ],
    },
    {
      id: "adot",
      label: "AWS Distro for OpenTelemetry",
      summary: "Send Lambda and ECS logs, traces and metrics over OTLP.",
      troubleshoot: [
        "Look in the collector's CloudWatch logs for lines saying Exporting failed.",
        "A 401 response means the token is wrong, revoked or paused.",
      ],
      steps: (context) => [
        {
          title: "Use this collector config",
          description:
            "For Lambda, add the ADOT layer and set OPENTELEMETRY_COLLECTOR_CONFIG_URI to this file. For ECS, run it as a sidecar.",
          code: { filename: "collector.yaml", content: adotConfig(context) },
        },
      ],
    },
  ],
}
