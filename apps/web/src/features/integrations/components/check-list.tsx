import { Check } from "lucide-react"
import { Eyebrow } from "@/components/ui"

interface CheckListProps {
  title: string
  items: string[]
}

export function CheckList({ title, items }: CheckListProps) {
  return (
    <div className="grid gap-2">
      <Eyebrow>{title}</Eyebrow>
      <ul className="grid gap-1.5 text-[0.8125rem] leading-5">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-brand" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
