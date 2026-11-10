"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react"
import { TOAST_POSITION, TOAST_VISIBLE_LIMIT } from "@/lib/toast/constants"

const TOAST_CLASS_NAMES = {
  toast:
    "group/toast border-line-strong bg-panel-2 text-text pointer-events-auto flex w-[22rem] max-w-[calc(100vw-2rem)] items-start gap-3 border border-l-[0.1875rem] px-4 py-3 shadow-[0_0.875rem_2rem_rgba(0,0,0,0.35)]",
  title: "text-sm leading-5 font-semibold",
  description: "text-muted-foreground mt-0.5 text-[0.8125rem] leading-5",
  icon: "mt-0.5 shrink-0",
  closeButton:
    "border-line-strong bg-panel-2 text-muted-foreground hover:text-text absolute -top-2 -right-2 grid size-5 place-items-center border",
  success: "border-l-ok [&_[data-icon]]:text-ok",
  error: "border-l-danger [&_[data-icon]]:text-danger",
  warning: "border-l-warn [&_[data-icon]]:text-warn",
  info: "border-l-info [&_[data-icon]]:text-info",
} as const

const TOAST_ICONS = {
  success: <CircleCheck className="size-4" />,
  error: <CircleAlert className="size-4" />,
  warning: <TriangleAlert className="size-4" />,
  info: <Info className="size-4" />,
  close: <X className="size-3" />,
} as const

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position={TOAST_POSITION}
      visibleToasts={TOAST_VISIBLE_LIMIT}
      closeButton
      icons={TOAST_ICONS}
      toastOptions={{ unstyled: true, classNames: TOAST_CLASS_NAMES }}
      {...props}
    />
  )
}
