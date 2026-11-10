export const SDK_DOWNLOADS = {
  NODE: "ape-agent.tgz",
  PYTHON: "ape_agent-0.1.0-py3-none-any.whl",
} as const

export const downloadUrl = (webUrl: string, file: string) => `${webUrl}/downloads/${file}`
