"use client"

import { Spinner } from "@/components/ui"
import { useReports, useStructure } from "../hooks"
import { ReportComposer } from "./report-composer"
import { ReportItem } from "./report-item"

interface ReportsTabProps {
  workspaceId: string
  pageId: string
  canPost: boolean
}

export function ReportsTab({ workspaceId, pageId, canPost }: ReportsTabProps) {
  const reports = useReports(workspaceId, pageId)
  const structure = useStructure(workspaceId, pageId)
  const resources = (structure.data?.sections ?? []).flatMap((s) =>
    s.resources.map((r) => ({ id: r.id, publicName: r.publicName }))
  )

  return (
    <div className="grid gap-4">
      {canPost && (
        <ReportComposer workspaceId={workspaceId} pageId={pageId} resources={resources} />
      )}
      {reports.isPending ? (
        <Spinner className="size-5" />
      ) : (reports.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No status updates yet. Monitor incidents on linked resources create one automatically.
        </p>
      ) : (
        (reports.data ?? []).map((report) => (
          <ReportItem
            key={report.id}
            workspaceId={workspaceId}
            pageId={pageId}
            report={report}
            canPost={canPost}
          />
        ))
      )}
    </div>
  )
}
