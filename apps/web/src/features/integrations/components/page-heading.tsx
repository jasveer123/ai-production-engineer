import { Eyebrow } from "@/components/ui"

interface PageHeadingProps {
  workspaceName: string
  title: string
}

export function PageHeading({ workspaceName, title }: PageHeadingProps) {
  return (
    <div className="grid gap-1.5">
      <Eyebrow>Workspace · {workspaceName}</Eyebrow>
      <h1 className="font-heading text-[1.75rem] leading-[2.125rem] font-semibold tracking-tight">
        {title}
      </h1>
    </div>
  )
}
