import type { PublicStatus } from "../schemas"

interface PublicHeaderProps {
  data: Pick<
    PublicStatus,
    | "name"
    | "description"
    | "logoUrl"
    | "logoDarkUrl"
    | "homepageUrl"
    | "contactUrl"
    | "headerLayout"
  >
}

export function PublicHeader({ data }: PublicHeaderProps) {
  const showLogo = data.logoUrl && data.headerLayout !== "name_only"
  const showName = !showLogo || data.headerLayout !== "logo_only"
  const logo = showLogo && (
    <>
      <img
        src={data.logoUrl!}
        alt={data.name}
        className="h-10 w-auto in-data-[theme=dark]:hidden"
      />
      <img
        src={data.logoDarkUrl ?? data.logoUrl!}
        alt={data.name}
        className="hidden h-10 w-auto in-data-[theme=dark]:block"
      />
    </>
  )

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="grid gap-1">
        <div className="flex items-center gap-3">
          {data.homepageUrl ? (
            <a href={data.homepageUrl} rel="noreferrer" className="flex items-center gap-3">
              {logo}
            </a>
          ) : (
            logo
          )}
          {showName && (
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{data.name}</h1>
          )}
        </div>
        {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
      </div>
      {data.contactUrl && (
        <a
          href={data.contactUrl}
          rel="noreferrer"
          className="border border-line px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-panel-2"
        >
          Get in touch
        </a>
      )}
    </header>
  )
}
