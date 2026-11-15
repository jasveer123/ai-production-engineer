import { cn } from "@/lib/utils"

interface DiffViewProps {
  diff: string
}

function lineClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ")) {
    return "font-semibold text-text"
  }
  if (line.startsWith("@@")) return "bg-info-soft text-info"
  if (line.startsWith("+")) return "bg-ok-soft text-ok"
  if (line.startsWith("-")) return "bg-danger-soft text-danger"
  return "text-muted-foreground"
}

export function DiffView({ diff }: DiffViewProps) {
  return (
    <pre className="max-h-[32rem] overflow-auto border border-line bg-sunken py-2 font-mono text-[0.75rem] leading-5">
      {diff.split("\n").map((line, index) => (
        <span key={index} className={cn("block px-3 whitespace-pre", lineClass(line))}>
          {line || " "}
        </span>
      ))}
    </pre>
  )
}
