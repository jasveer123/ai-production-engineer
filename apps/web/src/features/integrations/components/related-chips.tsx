import Link from "next/link"
import { Button, Eyebrow } from "@/components/ui"
import type { IntegrationDefinition } from "../catalog"

interface RelatedChipsProps {
  related: IntegrationDefinition[]
  href: (id: string) => string
}

export function RelatedChips({ related, href }: RelatedChipsProps) {
  if (related.length === 0) return null

  return (
    <div className="grid gap-2">
      <Eyebrow>Often used with</Eyebrow>
      <div className="flex flex-wrap gap-2">
        {related.map((item) => (
          <Button
            key={item.id}
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={href(item.id)} />}
          >
            {item.name}
          </Button>
        ))}
      </div>
    </div>
  )
}
