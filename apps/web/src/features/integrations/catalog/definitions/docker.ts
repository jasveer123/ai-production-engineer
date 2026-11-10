import DockerLogo from "@/assets/svg/docker.svg"
import { INTEGRATION_GROUP, INTEGRATION_ID } from "../../constants"
import { fluentBitOutput, vectorSink } from "../snippets"
import type { IntegrationDefinition, SnippetContext } from "../types"

const COLLECTOR_CONTAINER = "pramaan-docker-logs"

const vectorConfig = (context: SnippetContext) =>
  [
    "sources:",
    "  containers:",
    "    type: docker_logs",
    "    exclude_containers:",
    `      - ${COLLECTOR_CONTAINER}`,
    "transforms:",
    "  label:",
    "    type: remap",
    "    inputs:",
    "      - containers",
    "    source: |",
    "      .service = .container_name",
    ...vectorSink(context, { input: "label", query: `env=${context.environment}` }),
  ].join("\n")

export const docker: IntegrationDefinition = {
  id: INTEGRATION_ID.DOCKER,
  name: "Docker",
  tagline: "Every container on a host",
  description:
    "One extra container reads the output of all your other containers. Your apps and images stay exactly as they are.",
  group: INTEGRATION_GROUP.COLLECT,
  way: "agent",
  icon: DockerLogo,
  codeChange: false,
  facts: {
    access:
      "Read access to the Docker socket (/var/run/docker.sock) so the collector can see your containers.",
    limits: "Up to 10 MB per request, and logs are kept 7 days by default.",
  },
  collects: [
    "Everything every container writes to its output",
    "The container name, used as the service name",
    "Structured JSON lines, with their level and message",
  ],
  docsUrl: "https://vector.dev/docs/reference/configuration/sources/docker_logs/",
  related: [INTEGRATION_ID.VECTOR, INTEGRATION_ID.FLUENT_BIT],
  methods: [
    {
      id: "vector",
      label: "Vector container",
      summary: "One container reads every other container's output.",
      troubleshoot: [
        `Run docker logs ${COLLECTOR_CONTAINER} and look for errors.`,
        "If Docker cannot find host.docker.internal, replace it with your machine's address.",
        "The collector needs the Docker socket mounted. Check the -v /var/run/docker.sock line.",
      ],
      steps: (context) => [
        {
          title: "Save this config",
          description: "It labels each log with the container's name.",
          code: { filename: "vector.yaml", content: vectorConfig(context) },
        },
        {
          title: "Start the collector container",
          code: {
            filename: "terminal",
            content: [
              `docker run -d --name ${COLLECTOR_CONTAINER} \\`,
              "  -v /var/run/docker.sock:/var/run/docker.sock \\",
              "  -v $PWD/vector.yaml:/etc/vector/vector.yaml:ro \\",
              "  timberio/vector:latest-alpine",
            ].join("\n"),
          },
        },
      ],
    },
    {
      id: "compose",
      label: "Docker Compose",
      summary: "Add the collector to a compose file you already use.",
      troubleshoot: [
        `The container_name must stay ${COLLECTOR_CONTAINER}, or the collector reads its own logs.`,
        "Run docker compose logs pramaan-logs and look for errors.",
        "Run docker compose up -d again after you change vector.yaml.",
      ],
      steps: (context) => [
        {
          title: "Save the collector config",
          code: { filename: "vector.yaml", content: vectorConfig(context) },
        },
        {
          title: "Add this service to your compose file",
          code: {
            filename: "compose.yaml",
            content: [
              "services:",
              "  pramaan-logs:",
              "    image: timberio/vector:latest-alpine",
              `    container_name: ${COLLECTOR_CONTAINER}`,
              "    volumes:",
              "      - /var/run/docker.sock:/var/run/docker.sock",
              "      - ./vector.yaml:/etc/vector/vector.yaml:ro",
            ].join("\n"),
          },
        },
        {
          title: "Start it",
          code: { filename: "terminal", content: "docker compose up -d pramaan-logs" },
        },
      ],
    },
    {
      id: "logging-driver",
      label: "Docker logging driver",
      summary: "Docker sends each container's logs to Fluent Bit for you.",
      troubleshoot: [
        "Start the Fluent Bit container before the containers that use the fluentd driver.",
        "Run docker logs pramaan-fluent-bit and look for errors.",
        "Containers started before you set the driver keep their old driver. Recreate them.",
      ],
      steps: (context) => [
        {
          title: "Save this Fluent Bit config",
          description: "It listens for Docker's logs on port 24224 and forwards them to us.",
          code: {
            filename: "fluent-bit.conf",
            content: [
              "[INPUT]",
              "    Name   forward",
              "    Listen 0.0.0.0",
              "    Port   24224",
              "",
              "[FILTER]",
              "    Name   modify",
              "    Match  *",
              "    Rename container_name service",
              "    Rename log message",
              "",
              ...fluentBitOutput(context, { query: `env=${context.environment}` }),
            ].join("\n"),
          },
        },
        {
          title: "Start Fluent Bit",
          code: {
            filename: "terminal",
            content: [
              "docker run -d --name pramaan-fluent-bit -p 24224:24224 \\",
              "  -v $PWD/fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf:ro \\",
              "  fluent/fluent-bit:latest",
            ].join("\n"),
          },
        },
        {
          title: "Start your containers with the fluentd driver",
          description: "Add these two options to every container you want to collect.",
          code: {
            filename: "terminal",
            content: [
              "docker run -d --name my-app \\",
              "  --log-driver=fluentd \\",
              "  --log-opt fluentd-address=localhost:24224 \\",
              "  my-image",
            ].join("\n"),
          },
        },
      ],
    },
  ],
}
