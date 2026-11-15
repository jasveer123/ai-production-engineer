"use client"

import * as React from "react"
import { PublicStatusLoader } from "./public-status-loader"

interface PublicDomainPageProps {
  params: Promise<{ host: string }>
}

export function PublicDomainPage({ params }: PublicDomainPageProps) {
  const { host } = React.use(params)
  return <PublicStatusLoader lookup={{ host: decodeURIComponent(host) }} />
}
