"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const COMPOSER_SLOT_ID = "composer-slot"

interface ComposerContext {
  open: boolean
  setOpen: (open: boolean) => void
}

const Context = React.createContext<ComposerContext | null>(null)

function useComposer() {
  const context = React.useContext(Context)
  if (!context) throw new Error("Composer parts must be used inside <Drawer>")
  return context
}

interface DrawerProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Drawer({ open: controlled, defaultOpen = false, onOpenChange, children }: DrawerProps) {
  const [inner, setInner] = React.useState(defaultOpen)
  const open = controlled ?? inner
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (controlled === undefined) setInner(next)
      onOpenChange?.(next)
    },
    [controlled, onOpenChange]
  )
  const value = React.useMemo(() => ({ open, setOpen }), [open, setOpen])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

interface DrawerTriggerProps extends React.ComponentProps<"button"> {
  render?: React.ReactElement<React.ComponentProps<"button">>
}

function DrawerTrigger({ render, children, onClick, ...props }: DrawerTriggerProps) {
  const { open, setOpen } = useComposer()
  const element = render ?? <button type="button" />

  return React.cloneElement(
    element,
    {
      ...props,
      "aria-expanded": open,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        setOpen(!open)
      },
    } as React.ComponentProps<"button">,
    children
  )
}

function DrawerClose({ render, children, onClick, ...props }: DrawerTriggerProps) {
  const { setOpen } = useComposer()
  const element = render ?? <button type="button" />

  return React.cloneElement(
    element,
    {
      ...props,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        setOpen(false)
      },
    } as React.ComponentProps<"button">,
    children
  )
}

function DrawerContent({ className, children }: React.ComponentProps<"div">) {
  const { open, setOpen } = useComposer()
  const ref = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    if (!open) return
    const node = ref.current
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    node?.querySelector<HTMLElement>("input,textarea,select,button[aria-pressed]")?.focus({
      preventScroll: true,
    })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, setOpen])

  if (!open) return null
  const body = (
    <section
      ref={ref}
      data-slot="composer"
      className={cn(
        "relative mb-6 grid content-start gap-5 border border-brand/40 bg-panel p-5 text-sm text-text shadow-sm",
        className
      )}
    >
      {children}
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-3 right-3"
        aria-label="Close"
        onClick={() => setOpen(false)}
      >
        <XIcon />
      </Button>
    </section>
  )

  return <ComposerPortal>{body}</ComposerPortal>
}

function ComposerPortal({ children }: { children: React.ReactNode }) {
  const [host] = React.useState(() => document.createElement("div"))

  React.useLayoutEffect(() => {
    let anchor: Element | null = document.querySelector("main h1")
    while (anchor && !anchor.nextElementSibling) anchor = anchor.parentElement
    const fallback = document.getElementById(COMPOSER_SLOT_ID)
    if (anchor && anchor.tagName !== "MAIN") anchor.after(host)
    else fallback?.append(host)
    return () => host.remove()
  }, [host])

  return createPortal(children, host)
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 pr-8", className)} {...props} />
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "-mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-line bg-sunken p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("font-heading text-lg font-semibold", className)} {...props} />
}

function DrawerDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
}
