export const VECTOR_VERSION = '0.46.1';

export function vectorConfig(opts: {
  endpoint: string;
  service: string;
  logPaths: string[];
  journald: boolean;
  docker: boolean;
  kubernetes?: boolean;
}): string {
  const sources: string[] = [];
  const inputs: string[] = [];
  if (opts.kubernetes) {
    sources.push('  k8s:\n    type: kubernetes_logs');
    inputs.push('k8s_service');
  } else {
    if (opts.logPaths.length) {
      sources.push(
        `  files:\n    type: file\n    include:\n${opts.logPaths.map((p) => `      - ${JSON.stringify(p)}`).join('\n')}\n    ignore_older_secs: 86400`,
      );
      inputs.push('files');
    }
    if (opts.journald) {
      sources.push('  journald:\n    type: journald');
      inputs.push('journald');
    }
    if (opts.docker) {
      sources.push('  docker:\n    type: docker_logs');
      inputs.push('docker');
    }
  }
  const transforms = opts.kubernetes
    ? `transforms:
  k8s_service:
    type: remap
    inputs: [k8s]
    source: |
      .service = .kubernetes.pod_labels."app.kubernetes.io/name" ?? .kubernetes.pod_labels.app ?? .kubernetes.container_name
      .host = .kubernetes.pod_node_name
`
    : '';
  return `# Written by the AI Production Engineer agent installer.
data_dir: /var/lib/vector
sources:
${sources.join('\n')}
${transforms}sinks:
  ape:
    type: http
    inputs: [${inputs.join(', ')}]
    uri: "${opts.endpoint}/v1/logs?way=agent&service=${encodeURIComponent(opts.service)}"
    method: post
    encoding:
      codec: json
    compression: gzip
    auth:
      strategy: bearer
      token: "\${APE_TOKEN}"
    batch:
      max_bytes: 4000000
      timeout_secs: 2
    request:
      retry_attempts: 10
`;
}

// eslint-disable-next-line max-lines-per-function -- embedded POSIX shell script; splitting it would hide the script
export function installScript(defaultEndpoint: string): string {
  return `#!/bin/sh
# AI Production Engineer server agent (Vector). Usage:
#   curl -fsSL ${defaultEndpoint}/install/agent.sh | sudo APE_TOKEN=ape_live_... APE_SERVICE=my-app sh
# Options (env): APE_ENDPOINT, APE_SERVICE, APE_LOG_PATHS (comma list), APE_MODE=systemd|docker
set -eu

APE_ENDPOINT="\${APE_ENDPOINT:-${defaultEndpoint}}"
APE_SERVICE="\${APE_SERVICE:-$(hostname)}"
APE_LOG_PATHS="\${APE_LOG_PATHS:-/var/log/*.log,/var/log/**/*.log}"
VECTOR_VERSION="${VECTOR_VERSION}"

say() { printf '[ape-agent] %s\\n' "$*"; }
die() { say "$*" >&2; exit 1; }

[ -n "\${APE_TOKEN:-}" ] || die "Set APE_TOKEN (Integrations page in the app)."
[ "$(id -u)" -eq 0 ] || die "Run as root (sudo)."
command -v curl >/dev/null 2>&1 || die "curl is required."
command -v bash >/dev/null 2>&1 || [ "\${APE_MODE:-}" = docker ] || die "bash is required (or use APE_MODE=docker)."

MODE="\${APE_MODE:-}"
if [ -z "$MODE" ]; then
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then MODE=systemd
  elif command -v docker >/dev/null 2>&1; then MODE=docker
  else die "Need systemd or Docker."; fi
fi

mkdir -p /etc/ape /var/lib/vector
umask 077
printf 'APE_TOKEN=%s\\n' "$APE_TOKEN" > /etc/ape/agent.env

JOURNALD=false; command -v journalctl >/dev/null 2>&1 && JOURNALD=true
DOCKER=false; [ -S /var/run/docker.sock ] && DOCKER=true

{
  echo "data_dir: /var/lib/vector"
  echo "sources:"
  echo "  files:"
  echo "    type: file"
  echo "    ignore_older_secs: 86400"
  echo "    include:"
  echo "$APE_LOG_PATHS" | tr ',' '\\n' | while read -r p; do [ -n "$p" ] && echo "      - \\"$p\\""; done
  INPUTS="files"
  if [ "$JOURNALD" = true ] && [ "$MODE" = systemd ]; then echo "  journald:"; echo "    type: journald"; INPUTS="$INPUTS, journald"; fi
  if [ "$DOCKER" = true ]; then echo "  docker:"; echo "    type: docker_logs"; INPUTS="$INPUTS, docker"; fi
  echo "sinks:"
  echo "  ape:"
  echo "    type: http"
  echo "    inputs: [$INPUTS]"
  echo "    uri: \\"$APE_ENDPOINT/v1/logs?way=agent&service=$APE_SERVICE\\""
  echo "    encoding: { codec: json }"
  echo "    compression: gzip"
  echo "    auth: { strategy: bearer, token: \\"\\\${APE_TOKEN}\\" }"
  echo "    batch: { max_bytes: 4000000, timeout_secs: 2 }"
  echo "    request: { retry_attempts: 10 }"
} > /etc/ape/vector.yaml
umask 022

if [ "$MODE" = docker ]; then
  docker rm -f ape-agent >/dev/null 2>&1 || true
  docker run -d --name ape-agent --restart unless-stopped \\
    --env-file /etc/ape/agent.env \\
    -v /etc/ape/vector.yaml:/etc/vector/vector.yaml:ro \\
    -v /var/log:/var/log:ro -v /var/lib/vector:/var/lib/vector \\
    -v /var/run/docker.sock:/var/run/docker.sock:ro \\
    "timberio/vector:$VECTOR_VERSION-debian" --config /etc/vector/vector.yaml >/dev/null
  say "Running as Docker container ape-agent."
else
  if [ ! -x /opt/vector/bin/vector ]; then
    say "Installing Vector $VECTOR_VERSION..."
    curl --proto '=https' --tlsv1.2 -sSfL https://sh.vector.dev | VECTOR_VERSION="$VECTOR_VERSION" bash -s -- -y --prefix /opt/vector >/dev/null
  fi
  cat > /etc/systemd/system/ape-agent.service <<UNIT
[Unit]
Description=AI Production Engineer log agent (Vector)
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/ape/agent.env
ExecStart=/opt/vector/bin/vector --config /etc/ape/vector.yaml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable --now ape-agent >/dev/null
  systemctl restart ape-agent
  say "Running as systemd service ape-agent (journalctl -u ape-agent)."
fi
say "Done. The Integrations page turns green when the first logs arrive."
`;
}

export function kubernetesManifest(endpoint: string, service: string): string {
  const config = vectorConfig({
    endpoint,
    service,
    logPaths: [],
    journald: false,
    docker: false,
    kubernetes: true,
  })
    .split('\n')
    .map((l) => (l ? `    ${l}` : l))
    .join('\n');
  return `# AI Production Engineer log agent (Vector DaemonSet). First:
#   kubectl create namespace ape-agent
#   kubectl -n ape-agent create secret generic ape-agent --from-literal=APE_TOKEN=ape_live_...
apiVersion: v1
kind: ServiceAccount
metadata: { name: ape-agent, namespace: ape-agent }
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata: { name: ape-agent }
rules:
  - apiGroups: ['']
    resources: [pods, namespaces, nodes]
    verbs: [get, list, watch]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata: { name: ape-agent }
roleRef: { apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: ape-agent }
subjects: [{ kind: ServiceAccount, name: ape-agent, namespace: ape-agent }]
---
apiVersion: v1
kind: ConfigMap
metadata: { name: ape-agent, namespace: ape-agent }
data:
  vector.yaml: |
${config}
---
apiVersion: apps/v1
kind: DaemonSet
metadata: { name: ape-agent, namespace: ape-agent }
spec:
  selector: { matchLabels: { app: ape-agent } }
  template:
    metadata: { labels: { app: ape-agent } }
    spec:
      serviceAccountName: ape-agent
      tolerations: [{ operator: Exists }]
      containers:
        - name: vector
          image: timberio/vector:${VECTOR_VERSION}-debian
          args: [--config, /etc/vector/vector.yaml]
          env:
            - name: VECTOR_SELF_NODE_NAME
              valueFrom: { fieldRef: { fieldPath: spec.nodeName } }
          envFrom: [{ secretRef: { name: ape-agent } }]
          resources:
            requests: { cpu: 50m, memory: 64Mi }
            limits: { memory: 256Mi }
          volumeMounts:
            - { name: config, mountPath: /etc/vector, readOnly: true }
            - { name: data, mountPath: /var/lib/vector }
            - { name: varlog, mountPath: /var/log, readOnly: true }
            - { name: varlibpods, mountPath: /var/lib/kubelet/pods, readOnly: true }
      volumes:
        - { name: config, configMap: { name: ape-agent } }
        - { name: data, hostPath: { path: /var/lib/ape-agent } }
        - { name: varlog, hostPath: { path: /var/log } }
        - { name: varlibpods, hostPath: { path: /var/lib/kubelet/pods } }
`;
}
