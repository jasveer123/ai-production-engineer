import KubernetesLogo from "@/assets/svg/kubernetes.svg"
import { INTEGRATION_GROUP, INTEGRATION_ID } from "../../constants"
import { fluentBitOutput, vectorSink } from "../snippets"
import type { IntegrationDefinition, IntegrationStep, SnippetContext } from "../types"

const SECRET_NAME = "pramaan-token"
const SECRET_KEY = "token"
const TOKEN_ENV = "PRAMAAN_TOKEN"
const TOKEN_REFERENCE = `\${${TOKEN_ENV}}`

const secretStep = (context: SnippetContext): IntegrationStep => ({
  title: "Store your token as a secret",
  description: "Run this once in the cluster where you want to collect logs.",
  code: {
    filename: "terminal",
    content: `kubectl create secret generic ${SECRET_NAME} --from-literal=${SECRET_KEY}=${context.token}`,
  },
})

const reachNote =
  "Your cluster must be able to reach the address in the file. localhost only works on your own machine."

const envBlock = (indent: string) => [
  `${indent}env:`,
  `${indent}  - name: ${TOKEN_ENV}`,
  `${indent}    valueFrom:`,
  `${indent}      secretKeyRef:`,
  `${indent}        name: ${SECRET_NAME}`,
  `${indent}        key: ${SECRET_KEY}`,
]

const CHECKS = [
  "Run kubectl get pods and check the log reader pods are Running on every node.",
  "Run kubectl logs on one of those pods and look for errors reaching our address.",
  "Check the secret exists with kubectl get secret pramaan-token.",
]

export const kubernetes: IntegrationDefinition = {
  id: INTEGRATION_ID.KUBERNETES,
  name: "Kubernetes",
  tagline: "Every pod in a cluster",
  description:
    "Install a log reader on every node with Helm. It collects all your pods' logs and labels them with the app name.",
  group: INTEGRATION_GROUP.COLLECT,
  way: "agent",
  icon: KubernetesLogo,
  codeChange: false,
  facts: {
    access:
      "Permission to create a ClusterRole, a ClusterRoleBinding and a DaemonSet. The Helm chart creates them for you.",
    limits: "Up to 10 MB per request, and logs are kept 7 days by default.",
  },
  collects: [
    "Output of every container in every pod, on every node",
    "The app name, taken from the pod's app.kubernetes.io/name label",
    "Pod, namespace and container details",
  ],
  docsUrl: "https://vector.dev/docs/setup/installation/platforms/kubernetes/",
  related: [INTEGRATION_ID.VECTOR, INTEGRATION_ID.FLUENT_BIT],
  methods: [
    {
      id: "helm-vector",
      label: "Helm with Vector",
      summary: "Vector runs on every node and reads all pod logs.",
      troubleshoot: CHECKS,
      steps: (context) => [
        secretStep(context),
        {
          title: "Save this Helm values file",
          description: reachNote,
          code: {
            filename: "values.yaml",
            content: [
              "role: Agent",
              "service:",
              "  enabled: false",
              "serviceHeadless:",
              "  enabled: false",
              ...envBlock(""),
              "customConfig:",
              "  data_dir: /vector-data-dir",
              "  sources:",
              "    pods:",
              "      type: kubernetes_logs",
              "  transforms:",
              "    label:",
              "      type: remap",
              "      inputs:",
              "        - pods",
              "      source: |",
              '        .service = .kubernetes.pod_labels."app.kubernetes.io/name"',
              "        if is_null(.service) {",
              "          .service = .kubernetes.container_name",
              "        }",
              ...vectorSink(context, {
                input: "label",
                query: `env=${context.environment}`,
                indent: 2,
                tokenValue: `"${TOKEN_REFERENCE}"`,
              }),
            ].join("\n"),
          },
        },
        {
          title: "Install it with Helm",
          code: {
            filename: "terminal",
            content: [
              "helm repo add vector https://helm.vector.dev",
              "helm install vector vector/vector -f values.yaml",
            ].join("\n"),
          },
        },
      ],
    },
    {
      id: "helm-fluent-bit",
      label: "Helm with Fluent Bit",
      summary: "Fluent Bit runs on every node and reads all pod logs.",
      troubleshoot: CHECKS,
      steps: (context) => [
        secretStep(context),
        {
          title: "Save this Helm values file",
          description: reachNote,
          code: {
            filename: "values.yaml",
            content: [
              ...envBlock(""),
              "config:",
              "  inputs: |",
              "    [INPUT]",
              "        Name   tail",
              "        Path   /var/log/containers/*.log",
              "        Tag    kube.*",
              "        multiline.parser docker, cri",
              "  filters: |",
              "    [FILTER]",
              "        Name   kubernetes",
              "        Match  kube.*",
              "        Merge_Log On",
              "    [FILTER]",
              "        Name   nest",
              "        Match  kube.*",
              "        Operation lift",
              "        Nested_under kubernetes",
              "        Add_prefix kubernetes_",
              "    [FILTER]",
              "        Name   modify",
              "        Match  kube.*",
              "        Copy   kubernetes_container_name service",
              "        Rename log message",
              "  outputs: |",
              ...fluentBitOutput(context, {
                query: `env=${context.environment}`,
                tokenValue: TOKEN_REFERENCE,
              }).map((line) => `    ${line}`),
            ].join("\n"),
          },
        },
        {
          title: "Install it with Helm",
          code: {
            filename: "terminal",
            content: [
              "helm repo add fluent https://fluent.github.io/helm-charts",
              "helm install fluent-bit fluent/fluent-bit -f values.yaml",
            ].join("\n"),
          },
        },
      ],
    },
  ],
}
