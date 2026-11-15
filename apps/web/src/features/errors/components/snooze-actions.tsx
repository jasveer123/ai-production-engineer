"use client"

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui"
import { SNOOZE_OPTIONS } from "../constants"
import type { ErrorUpdate } from "../services"

interface SnoozeActionsProps {
  disabled: boolean
  onSnooze: (body: ErrorUpdate) => void
}

export function SnoozeActions({ disabled, onSnooze }: SnoozeActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={disabled} />}>
        Snooze
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {SNOOZE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.label}
            onClick={() => onSnooze({ status: "snoozed", ...option.body })}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
