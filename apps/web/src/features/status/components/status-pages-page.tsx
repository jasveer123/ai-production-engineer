"use client"

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

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Status pages" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
          Share a public page that shows your monitors and the updates you post while something is
          wrong.
        </p>
        {canManage && <PageDialog workspaceId={workspace.id} />}
      </div>
      {items.length === 0 ? (
        <p className="border border-dashed border-line p-8 text-center text-sm text-muted-foreground">
          No status pages yet.
        </p>
      ) : (
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
      )}
    </div>
  )
}
