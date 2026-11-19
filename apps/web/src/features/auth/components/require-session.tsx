"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { useSession } from "../hooks"
import { CreateWorkspaceForm } from "./create-workspace-form"

interface RequireSessionProps {
  children: React.ReactNode
}

export function RequireSession({ children }: RequireSessionProps) {
  const router = useRouter()
  const { data, isError } = useSession()

  React.useEffect(() => {
    if (isError) router.replace(ROUTES.login)
  }, [isError, router])

  if (!data) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (data.workspaces.length === 0) return <CreateWorkspaceForm email={data.user.email} />

  return children
}
