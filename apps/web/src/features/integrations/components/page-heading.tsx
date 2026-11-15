interface PageHeadingProps {
  workspaceName?: string
  title: string
  description?: string
}

export function PageHeading({ title, description }: PageHeadingProps) {
  return (
    <div className="grid gap-1">
      <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="max-w-prose text-[0.8125rem] text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
