"use client"

import { Chip, Field, Input, Switch } from "@/components/ui"
import { CONDITION_KEYS, SEVERITIES, WEEKDAYS } from "../constants"
import type { Condition } from "../schemas"

interface ConditionEditorProps {
  id: string
  when: Condition
  onChange: (when: Condition) => void
}

const defaultWindow = () => ({
  days: [1, 2, 3, 4, 5],
  from: "09:00",
  to: "17:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
})

export function ConditionEditor({ id, when, onChange }: ConditionEditorProps) {
  const pair = when.metadata?.[0]
  const window = when.timeWindow
  const setPair = (key: string, value: string) =>
    onChange({ ...when, metadata: value.trim() ? [{ key, value }] : undefined })

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Severity">
        <span className="text-[0.8125rem] text-muted-foreground">Severity at least</span>
        <Chip
          selected={!when.minSeverity}
          onClick={() => onChange({ ...when, minSeverity: undefined })}
        >
          Any
        </Chip>
        {SEVERITIES.map((item) => (
          <Chip
            key={item}
            selected={when.minSeverity === item}
            onClick={() => onChange({ ...when, minSeverity: item })}
          >
            {item}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Incident field">
          {CONDITION_KEYS.map((key) => (
            <Chip
              key={key}
              selected={(pair?.key ?? "service") === key}
              onClick={() => setPair(key, pair?.value ?? "")}
            >
              {key}
            </Chip>
          ))}
        </div>
        <Field label="equals" htmlFor={`${id}-meta`}>
          <Input
            id={`${id}-meta`}
            value={pair?.value ?? ""}
            placeholder="leave empty for any"
            onChange={(e) => setPair(pair?.key ?? "service", e.target.value)}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          size="sm"
          checked={Boolean(window)}
          onCheckedChange={(checked) =>
            onChange({ ...when, timeWindow: checked ? defaultWindow() : undefined })
          }
        />
        Only at certain times
      </label>
      {window && (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Days">
            {WEEKDAYS.map((day, index) => (
              <Chip
                key={day}
                selected={window.days.includes(index)}
                onClick={() =>
                  onChange({
                    ...when,
                    timeWindow: {
                      ...window,
                      days: window.days.includes(index)
                        ? window.days.filter((d) => d !== index)
                        : [...window.days, index].sort(),
                    },
                  })
                }
              >
                {day}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="From" htmlFor={`${id}-from`}>
              <Input
                id={`${id}-from`}
                type="time"
                value={window.from}
                onChange={(e) =>
                  onChange({ ...when, timeWindow: { ...window, from: e.target.value } })
                }
              />
            </Field>
            <Field label="To" htmlFor={`${id}-to`}>
              <Input
                id={`${id}-to`}
                type="time"
                value={window.to}
                onChange={(e) =>
                  onChange({ ...when, timeWindow: { ...window, to: e.target.value } })
                }
              />
            </Field>
            <Field label="Timezone" htmlFor={`${id}-tz`}>
              <Input
                id={`${id}-tz`}
                value={window.timezone}
                onChange={(e) =>
                  onChange({ ...when, timeWindow: { ...window, timezone: e.target.value } })
                }
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  )
}
