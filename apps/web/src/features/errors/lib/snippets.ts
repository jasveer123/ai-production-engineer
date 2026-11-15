export const SNIPPET_KINDS = [
  { value: "browser", label: "Browser" },
  { value: "node", label: "Node.js" },
  { value: "python", label: "Python" },
] as const

export type SnippetKind = (typeof SNIPPET_KINDS)[number]["value"]

export function sentrySnippet(kind: SnippetKind, dsn: string): string {
  if (kind === "python")
    return [
      "pip install sentry-sdk",
      "",
      "import sentry_sdk",
      "",
      "sentry_sdk.init(",
      `    dsn="${dsn}",`,
      '    release="my-app@1.0.0",',
      '    environment="production",',
      ")",
    ].join("\n")
  if (kind === "node")
    return [
      "npm install @sentry/node",
      "",
      'const Sentry = require("@sentry/node")',
      "",
      "Sentry.init({",
      `  dsn: "${dsn}",`,
      '  release: "my-app@1.0.0",',
      '  environment: "production",',
      "})",
    ].join("\n")
  return [
    "npm install @sentry/browser",
    "",
    'import * as Sentry from "@sentry/browser"',
    "",
    "Sentry.init({",
    `  dsn: "${dsn}",`,
    '  release: "my-app@1.0.0",',
    '  environment: "production",',
    "})",
  ].join("\n")
}
