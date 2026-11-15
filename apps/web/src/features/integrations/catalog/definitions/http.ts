import HttpRequestLogo from "@/assets/svg/http-request.svg"
import { INGEST_ENDPOINTS } from "@/lib/api/endpoints"
import { INTEGRATION_GROUP, INTEGRATION_ID } from "../../constants"
import type { IntegrationDefinition } from "../types"

export const http: IntegrationDefinition = {
  id: INTEGRATION_ID.HTTP,
  name: "HTTP",
  tagline: "POST JSON from anywhere",
  description:
    "Send one JSON object, an array, or newline-separated JSON to our intake address with your source token. Works from scripts, cron jobs and any language.",
  group: INTEGRATION_GROUP.CODE,
  way: "http",
  icon: HttpRequestLogo,
  codeChange: true,
  facts: {
    access: "Network access from where you send to our intake address.",
    limits: "Up to 10 MB per request (gzip is accepted), and logs are kept 7 days by default.",
  },
  collects: [
    "Any fields you send; message, level, service and timestamp are recognised",
    "Everything else is kept as searchable attributes",
  ],
  related: [INTEGRATION_ID.VECTOR, INTEGRATION_ID.JAVASCRIPT],
  methods: [
    {
      id: "curl",
      label: "curl",
      summary: "One request per batch of logs.",
      troubleshoot: [
        "A 401 response means the token is wrong, revoked or paused.",
        "A 400 response means the body is not valid JSON.",
        "Add ?service=name to the address if your lines have no service field.",
      ],
      steps: (context) => [
        {
          title: "Send a log line",
          code: {
            filename: "terminal",
            content: [
              `curl -X POST "${context.ingestUrl}${INGEST_ENDPOINTS.SEND_LOGS}?service=${context.service}&env=${context.environment}" \\`,
              `  -H "Authorization: Bearer ${context.token}" \\`,
              '  -H "Content-Type: application/json" \\',
              `  -d '{"level":"info","message":"Hello from curl","user":{"id":42}}'`,
            ].join("\n"),
          },
        },
        {
          title: "Send many lines at once",
          description: "Separate JSON objects with new lines, or send a JSON array.",
          code: {
            filename: "logs.ndjson",
            content: [
              '{"level":"info","message":"order created","order_id":"A1"}',
              '{"level":"error","message":"payment failed","status":502}',
            ].join("\n"),
          },
        },
      ],
    },
  ],
}
