import { COLLECTOR } from "../constants"
import { downloadUrl, SDK_DOWNLOADS } from "./snippets"
import type { IntegrationStep, SnippetContext } from "./types"

const downloadStep = (context: SnippetContext, registry: boolean): IntegrationStep => ({
  title: registry
    ? "Download the collector and push its image"
    : "Download and build the collector",
  description: registry
    ? "Your nodes must be able to pull the image, so push it to a registry you use."
    : undefined,
  code: {
    filename: "terminal",
    content: [
      `curl -O ${downloadUrl(context.webUrl, SDK_DOWNLOADS.COLLECTOR)}`,
      `mkdir ${COLLECTOR.CHART_NAME} && tar xzf ${SDK_DOWNLOADS.COLLECTOR} -C ${COLLECTOR.CHART_NAME}`,
      registry
        ? `docker build -t YOUR_REGISTRY/${COLLECTOR.CHART_NAME}:0.1.0 ${COLLECTOR.CHART_NAME}`
        : `docker build -t ${COLLECTOR.IMAGE} ${COLLECTOR.CHART_NAME}`,
      ...(registry ? [`docker push YOUR_REGISTRY/${COLLECTOR.CHART_NAME}:0.1.0`] : []),
    ].join("\n"),
  },
})

export const collectorDockerSteps = (context: SnippetContext): IntegrationStep[] => [
  downloadStep(context, false),
  {
    title: "Start it",
    description: "It labels each log with the container's name.",
    code: {
      filename: "terminal",
      content: [
        `docker run -d --name ${COLLECTOR.CONTAINER} \\`,
        `  -e PRAMAAN_INGEST_URL=${context.containerIngestUrl} \\`,
        `  -e PRAMAAN_TOKEN=${context.token} \\`,
        `  -e PRAMAAN_ENV=${context.environment} \\`,
        "  -v /var/run/docker.sock:/var/run/docker.sock \\",
        `  ${COLLECTOR.IMAGE}`,
      ].join("\n"),
    },
  },
]

export const collectorKubernetesSteps = (context: SnippetContext): IntegrationStep[] => [
  downloadStep(context, true),
  {
    title: "Store your token as a secret",
    description: "Run this once in the cluster where you want to collect logs.",
    code: {
      filename: "terminal",
      content: `kubectl create secret generic ${COLLECTOR.SECRET_NAME} --from-literal=${COLLECTOR.SECRET_KEY}=${context.token}`,
    },
  },
  {
    title: "Install it with Helm",
    description:
      "Your cluster must be able to reach the ingest address. localhost only works on your own machine.",
    code: {
      filename: "terminal",
      content: [
        `helm install ${COLLECTOR.CHART_NAME} ${COLLECTOR.CHART_NAME}/chart \\`,
        `  --set image.repository=YOUR_REGISTRY/${COLLECTOR.CHART_NAME} \\`,
        `  --set ingestUrl=${context.ingestUrl} \\`,
        `  --set environment=${context.environment} \\`,
        `  --set existingSecret=${COLLECTOR.SECRET_NAME}`,
      ].join("\n"),
    },
  },
]

export const COLLECTOR_TROUBLESHOOT = {
  docker: [
    `Run docker logs ${COLLECTOR.CONTAINER} and look for errors.`,
    "If Docker cannot find host.docker.internal, use your machine's address in PRAMAAN_INGEST_URL.",
    "The collector needs the Docker socket mounted. Check the -v /var/run/docker.sock line.",
  ],
  kubernetes: [
    "Run kubectl get pods and check a collector pod is Running on every node.",
    "Run kubectl logs on one collector pod and look for errors reaching the ingest address.",
    `Check the secret exists with kubectl get secret ${COLLECTOR.SECRET_NAME}.`,
  ],
}

export const COLLECTOR_COLLECTS = [
  "Everything every container or pod writes to its output",
  "The service name: the container name on Docker, the app.kubernetes.io/name label on Kubernetes",
  "Structured JSON lines, with their level and message",
]

export const COLLECTOR_LIMITS = [
  "It only sees stdout and stderr. Logs written to files inside a container are not collected.",
  "On Kubernetes it collects what is still in each node's log files when it starts.",
  "It needs read access to the Docker socket, or a cluster role on Kubernetes that the chart creates.",
]
