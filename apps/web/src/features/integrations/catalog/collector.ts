import type { IntegrationStep, SnippetContext } from "./types"

export const collectorDockerSteps = (context: SnippetContext): IntegrationStep[] => [
  {
    title: "Run this on your Linux server",
    description: "It needs Docker and root access. Run it once on each server you want to collect.",
    code: {
      filename: "terminal",
      content: `curl -fsSL ${context.webUrl}/api/install/agent.sh | sudo APE_TOKEN=${context.token} APE_MODE=docker sh`,
    },
  },
]

export const collectorKubernetesSteps = (context: SnippetContext): IntegrationStep[] => [
  {
    title: "Run this where kubectl points at your cluster",
    description: "Run it once per cluster. Running it again with a new token updates the old one.",
    code: {
      filename: "terminal",
      content: `curl -fsSL ${context.webUrl}/api/install/kubernetes.sh | APE_TOKEN=${context.token} sh`,
    },
  },
]

export const COLLECTOR_TROUBLESHOOT = {
  docker: [
    "Run docker logs ape-agent and look for errors.",
    "Unauthorized means the token is wrong or was revoked. Run the command again with a new token.",
    "Logs written to a file inside a container are not collected. Make the app print to the console.",
  ],
  kubernetes: [
    "Run kubectl -n ape-agent get pods and check a pod is Running on every node.",
    "Run kubectl -n ape-agent logs ds/ape-agent. Unauthorized means the token is wrong or was revoked. Run the command again with a new token.",
    "Logs written to a file inside a container are not collected. Make the app print to the console.",
  ],
}

export const COLLECTOR_COLLECTS = [
  "Everything every container or pod writes to its output",
  "The service name: the container name on Docker, the app label on Kubernetes",
  "Structured JSON lines, with their level and message",
]

export const COLLECTOR_LIMITS = [
  "It only sees stdout and stderr, not log files inside a container.",
  "On Kubernetes it collects what is still in each node's log files when it starts.",
  "Your apps and images are not changed and do not restart.",
]
