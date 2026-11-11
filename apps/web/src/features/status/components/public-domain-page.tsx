"use client"

import * as React from "react"
import { Spinner } from "@/components/ui"
import { usePublicStatusByDomain } from "../hooks"
import { PublicStatusView } from "./public-status-page"

interface PublicDomainPageProps {
  params: Promise<{ host: string }>
}

export function PublicDomainPage({ params }: PublicDomainPageProps) {
  const { host } = React.use(params)
  const status = usePublicStatusByDomain(decodeURIComponent(host))

  if (status.isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!status.data) {
    return (
      <main className="mx-auto grid max-w-3xl gap-2 px-6 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold">Status page not found</h1>
      </main>
    )
  }

  return <PublicStatusView data={status.data} />
}
