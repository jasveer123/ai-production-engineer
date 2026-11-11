"use client"

import { StoryBanner, StorySteps } from "@/components/shared"
import { Spinner } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { useStatusPages } from "../hooks"
import { PageCard } from "./page-card"
import { PageDialog } from "./page-dialog"

export function StatusPagesPage() {
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const pages = useStatusPages(workspace?.id)

  if (isPending || (workspace && pages.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const items = pages.data ?? []
  const canPost = ACTOR_ROLES.includes(workspace.role)

  const live = items.reduce(
    (n, page) => n + page.updates.filter((u) => u.state !== "resolved").length,
    0
  )
  const subscribers = items.reduce((n, page) => n + page.subscribers, 0)
  const create = canManage ? <PageDialog workspaceId={workspace.id} /> : null

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Status pages" />
      {items.length === 0 ? (
        <>
          <StoryBanner
            tone="idle"
            headline="Your customers have nowhere to look"
            detail="A status page answers “is it down?” before anyone files a ticket."
            action={create}
          />
          <StorySteps
            heading="How a status page works"
            steps={[
              { title: "Choose monitors", text: "Pick which services your customers care about." },
              {
                title: "It updates itself",
                text: "When a monitor fails, the page shows it and posts an update.",
              },
              {
                title: "Subscribers get told",
                text: "People who subscribe get emailed on every change.",
              },
            ]}
          />
        </>
      ) : (
        <>
          <StoryBanner
            tone={live > 0 ? "warn" : "ok"}
            headline={
              live > 0
                ? `${live} open incident update${live === 1 ? "" : "s"} on your pages`
                : "Your public pages show all clear"
            }
            detail={
              live > 0
                ? "Keep customers informed: post a change as things progress."
                : "Customers see the live state of every monitor you published."
            }
            action={create}
            stats={[
              { label: "Pages", value: items.length },
              { label: "Subscribers", value: subscribers },
              { label: "Monitors shown", value: new Set(items.flatMap((p) => p.monitorIds)).size },
              { label: "Custom domains", value: items.filter((p) => p.customDomain).length },
            ]}
          />
          <div className="grid gap-5">
            {items.map((page) => (
              <PageCard
                key={page.id}
                workspaceId={workspace.id}
                page={page}
                canManage={canManage}
                canPost={canPost}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
