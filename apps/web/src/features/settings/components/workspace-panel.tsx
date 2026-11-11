"use client"

import * as React from "react"
import { Button, Chip, Eyebrow, Field, Input, Spinner } from "@/components/ui"
import { PR_ROLES } from "../constants"
import { useApproval, useRenameWorkspace, useSetApproval } from "../hooks"

interface WorkspacePanelProps {
  workspaceId: string
  name: string
  canManage: boolean
  isOwner: boolean
}

export function WorkspacePanel({ workspaceId, name, canManage, isOwner }: WorkspacePanelProps) {
  const rename = useRenameWorkspace(workspaceId)
  const approval = useApproval(workspaceId)
  const setApproval = useSetApproval(workspaceId)
  const [draft, setDraft] = React.useState(name)
  const changed = draft.trim().length >= 2 && draft.trim() !== name

  return (
    <div className="grid max-w-xl gap-8">
      <form
        method="post"
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (changed) rename.mutate(draft.trim())
        }}
      >
        <Field label="Workspace name" htmlFor="workspace-name">
          <Input
            id="workspace-name"
            value={draft}
            maxLength={80}
            disabled={!canManage}
            onChange={(e) => setDraft(e.target.value)}
          />
        </Field>
        {canManage && (
          <Button type="submit" size="sm" className="w-fit" disabled={!changed || rename.isPending}>
            {rename.isPending && <Spinner />} Save name
          </Button>
        )}
      </form>
      <section className="grid gap-2">
        <Eyebrow>Who can approve a fix pull request</Eyebrow>
        <p className="text-[0.8125rem] text-muted-foreground">
          The lowest role allowed to open a pull request from an AI fix.
        </p>
        <div className="flex flex-wrap gap-2">
          {PR_ROLES.map((role) => (
            <Chip
              key={role}
              selected={approval.data?.prMinRole === role}
              disabled={!isOwner || setApproval.isPending || approval.isPending}
              onClick={() => setApproval.mutate(role)}
            >
              {role}
            </Chip>
          ))}
        </div>
        {!isOwner && (
          <p className="text-[0.75rem] text-muted-foreground">Only the owner can change this.</p>
        )}
      </section>
    </div>
  )
}
