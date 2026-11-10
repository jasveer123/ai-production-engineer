import { Check, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { PASSWORD_RULES, passwordScore } from "../password-rules"

const LABELS = ["Too short", "Weak", "Okay", "Good", "Strong"]

const METER_SEGMENTS = [0, 1, 2, 3]

interface PasswordStrengthProps {
  value: string
}

export function PasswordStrength({ value }: PasswordStrengthProps) {
  const score = passwordScore(value)
  const isVisible = value.length > 0

  return (
    <div
      aria-hidden={!isVisible}
      inert={!isVisible}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
        isVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="overflow-hidden">
        <div className="grid gap-2 pt-1">
          <div
            role="img"
            aria-label={`Password strength: ${LABELS[score]}`}
            className="grid grid-cols-4 gap-1"
          >
            {METER_SEGMENTS.map((segment) => (
              <i
                key={segment}
                className={cn(
                  "h-[0.1875rem] rounded-sm bg-line transition-colors duration-300",
                  segment < score && (score < 3 ? "bg-warn" : "bg-ok")
                )}
              />
            ))}
          </div>
          <ul className="grid gap-1 text-[0.8125rem]">
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(value)

              return (
                <li
                  key={rule.id}
                  className={cn(
                    "flex items-center gap-2 transition-colors duration-300",
                    passed ? "text-ok" : "text-muted-foreground"
                  )}
                >
                  {passed ? (
                    <Check className="size-3.5 animate-[pop_0.3s_ease-out]" />
                  ) : (
                    <Circle className="size-3.5" />
                  )}
                  {rule.label}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
