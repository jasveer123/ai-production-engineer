import { COLLECTOR } from "../constants"
import { downloadUrl, SDK_DOWNLOADS } from "./snippets"
import type { IntegrationStep, SnippetContext } from "./types"

const downloadStep = (context: SnippetContext): IntegrationStep => ({
  title: "Download and build the collector",
  code: {
    filename: "terminal",
    content: [
      `curl -O ${downloadUrl(context.webUrl, SDK_DOWNLOADS.COLLECTOR)}`,
      `mkdir ${COLLECTOR.CHART_NAME} && tar xzf ${SDK_DOWNLOADS.COLLECTOR} -C ${COLLECTOR.CHART_NAME}`,
      `docker build -t ${COLLECTOR.IMAGE} ${COLLECTOR.CHART_NAME}`,
    ].join("\n"),
  },
})

export const collectorDockerSteps = (context: SnippetContext): IntegrationStep[] => [
  downloadStep(context),
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
  {
    title: "Store your token as a secret",
    description: "Run this once in the cluster where you want to collect logs.",
    code: {
      filename: "terminal",
      content: [
        "kubectl create namespace ape-agent",
        `kubectl -n ape-agent create secret generic ape-agent --from-literal=APE_TOKEN=${context.token}`,
      ].join("\n"),
    },
  },
  {
    title: "Install the collector",
    description: "One command puts a collector on every node. Nothing else to configure.",
    code: {
      filename: "terminal",
      content: `kubectl apply -f ${context.webUrl}/api/install/kubernetes.yaml`,
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
    "Run kubectl -n ape-agent get pods and check a pod is Running on every node.",
    "Run kubectl -n ape-agent logs ds/ape-agent. Unauthorized means the token is wrong or was revoked.",
    "After you change or rotate the token, recreate the secret and run kubectl -n ape-agent rollout restart daemonset/ape-agent. Pods keep the old token until they restart.",
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
