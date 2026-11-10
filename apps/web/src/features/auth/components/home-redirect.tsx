"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/ui"
import { ROUTES } from "@/lib/constants/routes"
import { useSession } from "../hooks"

export function HomeRedirect() {
  const router = useRouter()
  const { isSuccess, isError } = useSession()

  React.useEffect(() => {
    if (isSuccess) router.replace(ROUTES.dashboard)
    if (isError) router.replace(ROUTES.login)
  }, [isSuccess, isError, router])

  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner className="size-6" />
    </div>
  )
}
