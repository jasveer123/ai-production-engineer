"use client"

import { Spinner } from "@/components/ui"
import { ApiError } from "@/lib/api"
import { usePublicStatus } from "../hooks"
import type { PageLookup } from "../services"
import { PasswordGate } from "./password-gate"
import { PublicStatusView } from "./public-status-view"

interface PublicStatusLoaderProps {
  lookup: PageLookup
}

const gateDetails = (error: unknown) => {
  if (!(error instanceof ApiError) || error.code !== "password_required") return null
  const details = error.details as { name?: string; slug?: string } | undefined
  return { name: details?.name ?? "Private status page", slug: details?.slug ?? "" }
}

export function PublicStatusLoader({ lookup }: PublicStatusLoaderProps) {
  const status = usePublicStatus(lookup)

  if (status.isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  const gate = gateDetails(status.error)
  if (gate) return <PasswordGate lookup={lookup} slug={gate.slug} name={gate.name} />

  if (!status.data) {
    return (
      <main className="mx-auto grid max-w-3xl gap-2 px-6 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold">Status page not found</h1>
        <p className="text-sm text-muted-foreground">Check the address and try again.</p>
      </main>
    )
  }

  return <PublicStatusView data={status.data} />
}
