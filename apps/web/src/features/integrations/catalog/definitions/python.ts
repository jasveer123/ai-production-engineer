import PythonLogo from "@/assets/svg/python.svg"
import { INTEGRATION_GROUP, INTEGRATION_ID } from "../../constants"
import { apeEnv, downloadUrl, SDK_DOWNLOADS } from "../snippets"
import type { IntegrationDefinition, IntegrationStep, SnippetContext } from "../types"

const installStep = (context: SnippetContext, extra = ""): IntegrationStep => ({
  title: "Install the package",
  description: "This downloads the package from your own Pramaan server.",
  code: {
    filename: "terminal",
    content: `pip install ${downloadUrl(context.webUrl, SDK_DOWNLOADS.PYTHON)}${extra}`,
  },
})

const envStep = (context: SnippetContext): IntegrationStep => ({
  title: "Add your settings",
  description: "Put these in your environment, or in your hosting provider's settings page.",
  code: { filename: "terminal", content: apeEnv(context) },
})

const COMMON_CHECKS = [
  "Run your app once. Logs are sent in batches every 2 seconds.",
  "Check APE_TOKEN and APE_ENDPOINT are set in the same terminal that starts your app.",
  "Look for a line starting with [ape-agent] in your app's error output.",
]

export const python: IntegrationDefinition = {
  id: INTEGRATION_ID.PYTHON,
  name: "Python",
  tagline: "Python 3.9 or newer",
  description:
    "A small package that sends your logging output, uncaught errors and traces from a Python app.",
  group: INTEGRATION_GROUP.CODE,
  way: "package",
  icon: PythonLogo,
  codeChange: true,
  facts: {
    access: "None. The package only sends data out over HTTPS.",
    limits:
      "Batches of up to 100 items every 2 seconds. Up to 10 MB per request, and logs are kept 7 days by default.",
  },
  collects: [
    "Everything written through the logging module",
    "Uncaught exceptions, including ones in threads",
    "Errors you report with capture_exception",
    "Unhandled errors from FastAPI and Flask requests",
  ],
  related: [INTEGRATION_ID.OPENTELEMETRY, INTEGRATION_ID.DOCKER],
  methods: [
    {
      id: "any",
      label: "Any Python app",
      summary: "Add two lines to the start of your app.",
      troubleshoot: COMMON_CHECKS,
      steps: (context) => [
        installStep(context),
        envStep(context),
        {
          title: "Start it first in your app",
          description: "Make it the first thing your app runs.",
          code: {
            filename: "main.py",
            content: ["import ape_agent", "ape_agent.start()"].join("\n"),
          },
        },
      ],
    },
    {
      id: "fastapi",
      label: "FastAPI",
      summary: "Also report errors raised inside requests.",
      troubleshoot: COMMON_CHECKS,
      steps: (context) => [
        installStep(context),
        envStep(context),
        {
          title: "Start it first, then add the middleware",
          code: {
            filename: "main.py",
            content: [
              "import ape_agent",
              "ape_agent.start()",
              "",
              "from fastapi import FastAPI",
              "from ape_agent.integrations import ApeASGIMiddleware",
              "",
              "app = FastAPI()",
              "app.add_middleware(ApeASGIMiddleware)",
              "",
              "@app.get('/checkout')",
              "def checkout():",
              "    raise RuntimeError('payment failed')",
            ].join("\n"),
          },
        },
      ],
    },
    {
      id: "flask",
      label: "Flask",
      summary: "Also report errors raised inside requests.",
      troubleshoot: COMMON_CHECKS,
      steps: (context) => [
        installStep(context),
        envStep(context),
        {
          title: "Start it first, then wrap the app",
          code: {
            filename: "app.py",
            content: [
              "import ape_agent",
              "ape_agent.start()",
              "",
              "from flask import Flask",
              "from ape_agent.integrations import ApeWSGIMiddleware",
              "",
              "app = Flask(__name__)",
              "app.wsgi_app = ApeWSGIMiddleware(app.wsgi_app)",
              "",
              "@app.get('/checkout')",
              "def checkout():",
              "    raise RuntimeError('payment failed')",
            ].join("\n"),
          },
        },
      ],
    },
  ],
}
