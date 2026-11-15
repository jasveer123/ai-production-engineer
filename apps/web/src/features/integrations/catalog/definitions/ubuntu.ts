import LinuxServerLogo from "@/assets/svg/linux-server.svg"
import { INTEGRATION_GROUP, INTEGRATION_ID } from "../../constants"
import { vectorSink } from "../snippets"
import type { IntegrationDefinition, SnippetContext } from "../types"

const onHost = (context: SnippetContext) => ({ ...context, containerIngestUrl: context.ingestUrl })

const vectorConfig = (context: SnippetContext) =>
  [
    "sources:",
    "  journal:",
    "    type: journald",
    "  files:",
    "    type: file",
    "    include:",
    "      - /var/log/syslog",
    "      - /var/log/auth.log",
    "      - /var/log/nginx/*.log",
    "transforms:",
    "  label:",
    "    type: remap",
    "    inputs:",
    "      - journal",
    "      - files",
    "    source: |",
    '      .service = .SYSLOG_IDENTIFIER || ._SYSTEMD_UNIT || "host"',
    "      .host = get_hostname!()",
    ...vectorSink(onHost(context), { input: "label", query: `env=${context.environment}` }),
  ].join("\n")

export const ubuntu: IntegrationDefinition = {
  id: INTEGRATION_ID.UBUNTU,
  name: "Ubuntu / Debian",
  tagline: "System journal and log files",
  description:
    "Install Vector from its apt repository. It reads the systemd journal and the log files you list on the server and sends them to us.",
  group: INTEGRATION_GROUP.COLLECT,
  way: "agent",
  icon: LinuxServerLogo,
  codeChange: false,
  facts: {
    access: "Root access to install a package and read /var/log and the systemd journal.",
    limits: "Up to 10 MB per request, and logs are kept 7 days by default.",
  },
  collects: [
    "Every systemd service's journal output, named after the unit",
    "The log files you list, such as syslog, auth.log and nginx",
    "The hostname of each server",
  ],
  docsUrl: "https://vector.dev/docs/setup/installation/package-managers/apt/",
  related: [INTEGRATION_ID.VECTOR, INTEGRATION_ID.DOCKER],
  methods: [
    {
      id: "apt",
      label: "Vector from apt",
      summary: "Install one package, save one config file, restart it.",
      troubleshoot: [
        "Run sudo journalctl -u vector -f and look for errors.",
        "Run sudo vector validate /etc/vector/vector.yaml after you edit the config.",
        "The vector user needs to be in the adm and systemd-journal groups to read logs.",
      ],
      steps: (context) => [
        {
          title: "Install Vector",
          code: {
            filename: "terminal",
            content: [
              'bash -c "$(curl -L https://setup.vector.dev)"',
              "sudo apt-get install -y vector",
              "sudo usermod -aG adm,systemd-journal vector",
            ].join("\n"),
          },
        },
        {
          title: "Save this config",
          code: { filename: "/etc/vector/vector.yaml", content: vectorConfig(context) },
        },
        {
          title: "Restart Vector",
          code: { filename: "terminal", content: "sudo systemctl restart vector" },
        },
      ],
    },
  ],
}
