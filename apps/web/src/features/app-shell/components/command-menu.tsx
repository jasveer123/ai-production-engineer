"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { SearchIcon, Siren } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle, Kbd } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { useOpenIncidents } from "@/features/integrations"
import { ROUTES } from "@/lib/constants/routes"
import { cn } from "@/lib/utils"
import { NAV_GROUPS } from "../constants"

interface Command {
  id: string
  label: string
  hint: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export function CommandMenu() {
  const router = useRouter()
  const { workspace } = useCurrentWorkspace()
  const incidents = useOpenIncidents(workspace?.id, true)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [cursor, setCursor] = React.useState(0)

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const commands = React.useMemo<Command[]>(
    () => [
      ...NAV_GROUPS.flatMap((group) =>
        group.items.map((item) => ({
          id: item.href,
          label: item.label,
          hint: group.label,
          href: item.href,
          icon: item.icon,
        }))
      ),
      ...(incidents.data ?? []).map((incident) => ({
        id: `incident-${incident.id}`,
        label: incident.title,
        hint: "Open incident",
        href: ROUTES.incidentDetail(incident.id),
        icon: Siren,
      })),
    ],
    [incidents.data]
  )

  const term = query.trim().toLowerCase()
  const results = commands.filter((item) =>
    `${item.label} ${item.hint}`.toLowerCase().includes(term)
  )
  const active = Math.min(cursor, Math.max(0, results.length - 1))

  const go = (command: Command | undefined) => {
    if (!command) return
    setOpen(false)
    router.push(command.href)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") setCursor(Math.min(active + 1, results.length - 1))
    else if (event.key === "ArrowUp") setCursor(Math.max(active - 1, 0))
    else if (event.key === "Enter") go(results[active])
    else return
    event.preventDefault()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 items-center gap-2 border border-line bg-sunken px-3 text-[0.8125rem] text-muted-foreground outline-none hover:border-line-strong focus-visible:ring-3 focus-visible:ring-brand/40 md:flex"
      >
        <SearchIcon className="size-3.5" aria-hidden />
        Search or jump to
        <Kbd>⌘K</Kbd>
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          setQuery("")
          setCursor(0)
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-[20%] translate-y-0 gap-0 p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Command menu</DialogTitle>
          <DialogDescription className="sr-only">
            Type to find a page or an open incident, then press Enter.
          </DialogDescription>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <SearchIcon className="size-4 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              aria-label="Search pages and incidents"
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search pages and open incidents"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setCursor(0)
              }}
              onKeyDown={onKeyDown}
            />
          </div>
          <ul role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-1">
            {results.length === 0 && (
              <li className="px-3 py-6 text-center text-[0.8125rem] text-muted-foreground">
                Nothing matches.
              </li>
            )}
            {results.map((item, index) => (
              <li
                key={item.id}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setCursor(index)}
                onClick={() => go(item)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm",
                  index === active && "bg-brand-soft text-brand-strong"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="text-[0.75rem] text-muted-foreground">{item.hint}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
