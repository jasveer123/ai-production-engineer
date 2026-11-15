"use client"

import { ArrowDown, ArrowUp } from "lucide-react"
import { Button, Checkbox, Eyebrow } from "@/components/ui"
import type { Member } from "../schemas"

interface PeoplePickerProps {
  members: Member[]
  selected: string[]
  onChange: (ids: string[]) => void
}

const label = (member: Member) => member.name ?? member.email

export function PeoplePicker({ members, selected, onChange }: PeoplePickerProps) {
  const nameOf = (id: string) => {
    const member = members.find((m) => m.userId === id)
    return member ? label(member) : "Former member (gap)"
  }
  const move = (index: number, direction: -1 | 1) => {
    const next = [...selected]
    ;[next[index], next[index + direction]] = [next[index + direction]!, next[index]!]
    onChange(next)
  }

  return (
    <div className="grid gap-2">
      <Eyebrow>People</Eyebrow>
      {members.map((member) => (
        <label key={member.userId} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={selected.includes(member.userId)}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...selected, member.userId]
                  : selected.filter((id) => id !== member.userId)
              )
            }
          />
          {label(member)}
          <span className="text-[0.75rem] text-muted-foreground">{member.role}</span>
        </label>
      ))}
      {selected.length > 1 && (
        <ol className="grid gap-1">
          {selected.map((id, index) => (
            <li
              key={id}
              className="flex items-center justify-between gap-2 border border-line px-3 py-1.5 text-sm"
            >
              <span>
                <span className="mr-2 font-mono text-[0.75rem] text-muted-foreground">
                  {index + 1}
                </span>
                {nameOf(id)}
              </span>
              <span className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${nameOf(id)} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${nameOf(id)} down`}
                  disabled={index === selected.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown />
                </Button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
