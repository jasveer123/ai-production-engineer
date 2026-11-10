import { Waypoints } from "lucide-react"
import { INTEGRATION_GROUP, INTEGRATION_ID } from "../../constants"
import { vectorSink } from "../snippets"
import type { IntegrationDefinition, SnippetContext } from "../types"

const config = (context: SnippetContext) =>
  [
    "sources:",
    "  app_logs:",
    "    type: file",
    "    include:",
    "      - /var/log/app/*.log",
    ...vectorSink(context, {
      input: "app_logs",
      query: `service=${context.service}&env=${context.environment}`,
    }),
  ].join("\n")

export const vector: IntegrationDefinition = {
  id: INTEGRATION_ID.VECTOR,
  name: "Vector",
  tagline: "Fast, light log shipper",
  description:
    "Vector reads log files on a server and forwards each new line. Good when your apps already write logs to files.",
  group: INTEGRATION_GROUP.COLLECT,
  way: "agent",
  icon: Waypoints,
  codeChange: false,
  facts: {
    access: "Read access to the log files you list.",
    limits: "Up to 10 MB per request, and logs are kept 7 days by default.",
  },
  collects: [
    "Every new line in the files you list",
    "Structured JSON lines, with their level and message",
    "The host name the line came from",
  ],
  docsUrl: "https://vector.dev/docs/",
  related: [INTEGRATION_ID.DOCKER, INTEGRATION_ID.KUBERNETES],
  methods: [
    {
      id: "linux",
      label: "Linux server",
      summary: "Install Vector from its package repository.",
      troubleshoot: [
        "Run systemctl status vector and journalctl -u vector -n 20.",
        "Vector reads only new lines. Write a line to a file in /var/log/app to test it.",
        "Check the vector user can read the files you list.",
      ],
      steps: (context) => [
        {
          title: "Install Vector",
          description: "For Ubuntu and Debian. Other systems: see the Vector install guide.",
          code: {
            filename: "terminal",
            content: [
              'bash -c "$(curl -L https://setup.vector.dev)"',
              "sudo apt-get install vector",
            ].join("\n"),
          },
        },
        {
          title: "Replace the config",
          code: { filename: "/etc/vector/vector.yaml", content: config(context) },
        },
        {
          title: "Restart Vector",
          code: { filename: "terminal", content: "sudo systemctl restart vector" },
        },
      ],
    },
    {
      id: "docker",
      label: "Docker",
      summary: "Run Vector as a container on any machine with Docker.",
      troubleshoot: [
        "Run docker logs pramaan-vector and look for errors.",
        "Vector reads only new lines. Write a line to a file in the mounted folder to test it.",
        "If Docker cannot find host.docker.internal, replace it with your machine's address.",
      ],
      steps: (context) => [
        {
          title: "Save this config",
          code: { filename: "vector.yaml", content: config(context) },
        },
        {
          title: "Run Vector",
          description: "Change /var/log/app to the folder that holds your logs.",
          code: {
            filename: "terminal",
            content: [
              "docker run -d --name pramaan-vector \\",
              "  -v $PWD/vector.yaml:/etc/vector/vector.yaml:ro \\",
              "  -v /var/log/app:/var/log/app:ro \\",
              "  timberio/vector:latest-alpine",
            ].join("\n"),
          },
        },
      ],
    },
  ],
}
