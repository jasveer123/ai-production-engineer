import FluentBitLogo from "@/assets/svg/fluent-bit.svg"
import { INTEGRATION_GROUP, INTEGRATION_ID } from "../../constants"
import { fluentBitOutput } from "../snippets"
import type { IntegrationDefinition, SnippetContext } from "../types"

const config = (context: SnippetContext) =>
  [
    "[INPUT]",
    "    Name   tail",
    "    Path   /var/log/app/*.log",
    "",
    ...fluentBitOutput(context, { query: `service=${context.service}&env=${context.environment}` }),
  ].join("\n")

export const fluentBit: IntegrationDefinition = {
  id: INTEGRATION_ID.FLUENT_BIT,
  name: "Fluent Bit",
  tagline: "Tiny log forwarder",
  description:
    "Fluent Bit follows log files and forwards new lines. It uses very little memory, so it suits small servers.",
  group: INTEGRATION_GROUP.COLLECT,
  way: "agent",
  icon: FluentBitLogo,
  codeChange: false,
  facts: {
    access: "Read access to the log files you list.",
    limits: "Up to 10 MB per request, and logs are kept 7 days by default.",
  },
  collects: [
    "Every new line in the files you list",
    "Structured JSON lines, with their level and message",
    "Timestamps, read in ISO format",
  ],
  docsUrl: "https://docs.fluentbit.io/manual",
  related: [INTEGRATION_ID.DOCKER, INTEGRATION_ID.KUBERNETES],
  methods: [
    {
      id: "linux",
      label: "Linux server",
      summary: "Install Fluent Bit with its official script.",
      troubleshoot: [
        "Run systemctl status fluent-bit and journalctl -u fluent-bit -n 20.",
        "Fluent Bit reads only new lines. Write a line to a file in /var/log/app to test it.",
        "Check the user running Fluent Bit can read the files you list.",
      ],
      steps: (context) => [
        {
          title: "Install Fluent Bit",
          code: {
            filename: "terminal",
            content:
              "curl https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh | sh",
          },
        },
        {
          title: "Replace the config",
          code: { filename: "/etc/fluent-bit/fluent-bit.conf", content: config(context) },
        },
        {
          title: "Restart Fluent Bit",
          code: { filename: "terminal", content: "sudo systemctl restart fluent-bit" },
        },
      ],
    },
    {
      id: "docker",
      label: "Docker",
      summary: "Run Fluent Bit as a container on any machine with Docker.",
      troubleshoot: [
        "Run docker logs pramaan-fluent-bit and look for errors.",
        "Fluent Bit reads only new lines. Write a line to a file in the mounted folder to test it.",
        "If Docker cannot find host.docker.internal, replace it with your machine's address.",
      ],
      steps: (context) => [
        {
          title: "Save this config",
          code: { filename: "fluent-bit.conf", content: config(context) },
        },
        {
          title: "Run Fluent Bit",
          description: "Change /var/log/app to the folder that holds your logs.",
          code: {
            filename: "terminal",
            content: [
              "docker run -d --name pramaan-fluent-bit \\",
              "  -v $PWD/fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf:ro \\",
              "  -v /var/log/app:/var/log/app:ro \\",
              "  fluent/fluent-bit:latest",
            ].join("\n"),
          },
        },
      ],
    },
  ],
}
