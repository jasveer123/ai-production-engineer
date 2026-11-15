"use client"

import { Spinner } from "@/components/ui"
import { useStructure } from "../hooks"
import { StructureEditor } from "./structure-editor"

interface StructureTabProps {
  workspaceId: string
  pageId: string
  canManage: boolean
}

export function StructureTab({ workspaceId, pageId, canManage }: StructureTabProps) {
  const structure = useStructure(workspaceId, pageId)

  if (structure.isPending) return <Spinner className="size-5" />
  if (!structure.data)
    return <p className="text-sm text-danger">Could not load the structure. Reload to try again.</p>

  return (
    <StructureEditor
      key={structure.dataUpdatedAt}
      workspaceId={workspaceId}
      pageId={pageId}
      initial={structure.data}
      canManage={canManage}
    />
  )
}
