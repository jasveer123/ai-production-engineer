import JavascriptLogo from "@/assets/svg/javascript.svg"
import { INTEGRATION_GROUP, INTEGRATION_ID } from "../../constants"
import { apeEnv, downloadUrl, SDK_DOWNLOADS } from "../snippets"
import type { IntegrationDefinition, IntegrationStep, SnippetContext } from "../types"

const installStep = (context: SnippetContext): IntegrationStep => ({
  title: "Install the package",
  description: "This downloads the package from your own Pramaan server.",
  code: {
    filename: "terminal",
    content: `npm install ${downloadUrl(context.webUrl, SDK_DOWNLOADS.NODE)}`,
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

export const javascript: IntegrationDefinition = {
  id: INTEGRATION_ID.JAVASCRIPT,
  name: "JavaScript and TypeScript",
  tagline: "Node.js 18 or newer",
  description:
    "A small package that sends your console logs, uncaught errors and traces from a Node.js app.",
  group: INTEGRATION_GROUP.CODE,
  way: "package",
  icon: JavascriptLogo,
  codeChange: true,
  facts: {
    access: "None. The package only sends data out over HTTPS.",
    limits:
      "Batches of up to 100 items every 2 seconds. Up to 10 MB per request, and logs are kept 7 days by default.",
  },
  collects: [
    "console.log, info, warn, error and debug output",
    "Uncaught exceptions and unhandled promise rejections",
    "Errors you report with captureException",
    "Traces, when the OpenTelemetry SDK is installed",
  ],
  related: [INTEGRATION_ID.OPENTELEMETRY, INTEGRATION_ID.DOCKER],
  methods: [
    {
      id: "package",
      label: "Node.js package",
      summary: "Add two lines to the start of your app.",
      troubleshoot: COMMON_CHECKS,
      steps: (context) => [
        installStep(context),
        envStep(context),
        {
          title: "Start it first in your app",
          description: "Make it the very first line, before any other import.",
          code: {
            filename: "server.js",
            content: ["const ape = require('@ape/agent')", "ape.start()"].join("\n"),
          },
        },
      ],
    },
    {
      id: "no-code",
      label: "No code changes",
      summary: "Load the package from the command line.",
      troubleshoot: COMMON_CHECKS,
      steps: (context) => [
        installStep(context),
        envStep(context),
        {
          title: "Start your app with the register file",
          description: "Node loads the package before your code runs.",
          code: {
            filename: "terminal",
            content: 'NODE_OPTIONS="--require @ape/agent/register" node server.js',
          },
        },
      ],
    },
    {
      id: "express",
      label: "Express",
      summary: "Also report errors thrown inside routes.",
      troubleshoot: COMMON_CHECKS,
      steps: (context) => [
        installStep(context),
        envStep(context),
        {
          title: "Start it first, then add the error handler",
          description: "The handler goes after all your routes.",
          code: {
            filename: "server.js",
            content: [
              "const ape = require('@ape/agent')",
              "ape.start()",
              "",
              "const express = require('express')",
              "const app = express()",
              "",
              "app.get('/checkout', () => {",
              "  throw new Error('payment failed')",
              "})",
              "",
              "app.use(ape.errorHandler())",
              "app.listen(3001)",
            ].join("\n"),
          },
        },
      ],
    },
  ],
}
