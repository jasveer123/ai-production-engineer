"use client"

import * as React from "react"
import { PublicStatusLoader } from "./public-status-loader"

interface PublicStatusPageProps {
  params: Promise<{ slug: string }>
}

export function PublicStatusPage({ params }: PublicStatusPageProps) {
  const { slug } = React.use(params)
  return <PublicStatusLoader lookup={{ slug }} />
}
