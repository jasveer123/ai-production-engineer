"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { useStatusPage } from "../hooks"
import { MaintenanceTab } from "./maintenance-tab"
import { ReportsTab } from "./reports-tab"
import { SettingsTab } from "./settings-tab"
import { StructureTab } from "./structure-tab"
import { SubscribersTab } from "./subscribers-tab"

export function StatusPageEditor() {
  const { pageId } = useParams<{ pageId: string }>()
  const { workspace, canManage, isPending } = useCurrentWorkspace()
  const page = useStatusPage(workspace?.id, pageId)

  if (isPending || (workspace && page.isPending)) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace || !page.data) {
    return (
      <div className="grid gap-2 py-24 text-center">
        <h1 className="font-heading text-xl font-semibold">Status page not found</h1>
        <Link href="/status-pages" className="text-sm text-brand-strong hover:underline">
          Back to status pages
        </Link>
      </div>
    )
  }

  const canPost = ACTOR_ROLES.includes(workspace.role)
  const ctx = { workspaceId: workspace.id, page: page.data }

  return (
    <div className="grid min-w-0 gap-5">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href="/status-pages" />}
      >
        <ArrowLeft /> All status pages
      </Button>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{page.data.name}</h1>
        <a
          href={`/status/${page.data.slug}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[0.8125rem] text-brand-strong hover:underline"
        >
          Open public page
        </a>
      </header>
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="reports">Status updates</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="pt-4">
          <SettingsTab {...ctx} canManage={canManage} />
        </TabsContent>
        <TabsContent value="structure" className="pt-4">
          <StructureTab workspaceId={workspace.id} pageId={pageId} canManage={canManage} />
        </TabsContent>
        <TabsContent value="reports" className="pt-4">
          <ReportsTab workspaceId={workspace.id} pageId={pageId} canPost={canPost} />
        </TabsContent>
        <TabsContent value="maintenance" className="pt-4">
          <MaintenanceTab workspaceId={workspace.id} pageId={pageId} canPost={canPost} />
        </TabsContent>
        <TabsContent value="subscribers" className="pt-4">
          <SubscribersTab workspaceId={workspace.id} pageId={pageId} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
