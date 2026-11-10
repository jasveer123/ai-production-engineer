import Link from "next/link"
import LogoMark from "@/assets/svg/logo-mark.svg"
import { ROUTES } from "@/lib/constants/routes"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
    <Link
      href={ROUTES.home}
      className={cn(
        "inline-flex items-center gap-3 font-heading text-xl font-medium tracking-tight text-text outline-none focus-visible:ring-3 focus-visible:ring-brand/40",
        className
      )}
    >
      <LogoMark className="size-[2.125rem]" />
      Pramaan
    </Link>
  )
}
