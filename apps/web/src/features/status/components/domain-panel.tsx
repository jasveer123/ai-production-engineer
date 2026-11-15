"use client"

import * as React from "react"
import { Badge, Button, CodeBlock, Eyebrow, Input, Spinner } from "@/components/ui"
import { useUpdatePage, useVerifyDomain } from "../hooks"
import type { StatusPage } from "../schemas"

interface DomainPanelProps {
  workspaceId: string
  page: StatusPage
}

export function DomainPanel({ workspaceId, page }: DomainPanelProps) {
  const setDomain = useUpdatePage(workspaceId, page.id, "Domain saved")
  const verify = useVerifyDomain(workspaceId, page.id)
  const [draft, setDraft] = React.useState("")

  return (
    <section className="grid max-w-2xl gap-2" aria-label="Custom domain">
      <Eyebrow>Custom domain</Eyebrow>
      {page.customDomain ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm">{page.customDomain}</span>
            <Badge variant={page.domainVerified ? "success" : "warning"}>
              {page.domainVerified ? "verified" : "not verified"}
            </Badge>
          </div>
          {!page.domainVerified && (
            <>
              <p className="text-[0.8125rem] text-muted-foreground">
                Add both DNS records at your DNS provider, wait for them to appear, then verify.
              </p>
              <CodeBlock>
                {`CNAME  ${page.customDomain}  ${page.cnameTarget}\nTXT    _pramaan.${page.customDomain}  pramaan-verify=${page.domainToken}`}
              </CodeBlock>
            </>
          )}
          <div className="flex gap-2">
            {!page.domainVerified && (
              <Button size="xs" disabled={verify.isPending} onClick={() => verify.mutate()}>
                {verify.isPending && <Spinner />} Verify domain
              </Button>
            )}
            <Button
              size="xs"
              variant="outline"
              disabled={setDomain.isPending}
              onClick={() => setDomain.mutate({ customDomain: null })}
            >
              Remove domain
            </Button>
          </div>
        </div>
      ) : (
        <form
          method="post"
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (draft.trim())
              setDomain.mutate({ customDomain: draft.trim() }, { onSuccess: () => setDraft("") })
          }}
        >
          <Input
            aria-label="Custom domain"
            className="w-64"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="status.example.com"
          />
          <Button type="submit" size="sm" disabled={!draft.trim() || setDomain.isPending}>
            Add domain
          </Button>
        </form>
      )}
    </section>
  )
}
