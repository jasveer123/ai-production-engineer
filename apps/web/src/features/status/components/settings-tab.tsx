"use client"

import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Chip, Eyebrow, Field, Input, Spinner, Switch } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { HEADER_LAYOUTS, THEMES } from "../constants"
import { settingsFormSchema, type SettingsFormValues } from "../forms"
import { useDeletePage, useUpdatePage } from "../hooks"
import type { StatusPage } from "../schemas"
import { DomainPanel } from "./domain-panel"
import { PasswordPanel } from "./password-panel"

interface SettingsTabProps {
  workspaceId: string
  page: StatusPage
  canManage: boolean
}

const URL_FIELDS = [
  { name: "logoUrl", label: "Logo URL", placeholder: "https://example.com/logo.png" },
  { name: "logoDarkUrl", label: "Logo URL for dark theme (optional)", placeholder: "https://" },
  { name: "homepageUrl", label: "Homepage URL", placeholder: "https://example.com" },
  { name: "contactUrl", label: "Contact URL", placeholder: "https://example.com/support" },
] as const

export function SettingsTab({ workspaceId, page, canManage }: SettingsTabProps) {
  const router = useRouter()
  const update = useUpdatePage(workspaceId, page.id)
  const remove = useDeletePage(workspaceId)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      name: page.name,
      slug: page.slug,
      description: page.description ?? "",
      logoUrl: page.logoUrl ?? "",
      logoDarkUrl: page.logoDarkUrl ?? "",
      homepageUrl: page.homepageUrl ?? "",
      contactUrl: page.contactUrl ?? "",
      theme: page.theme,
      headerLayout: page.headerLayout,
      hideFromSearch: page.hideFromSearch,
    },
  })

  const onSubmit = handleSubmit((v) =>
    update.mutate({
      ...v,
      description: v.description || null,
      logoUrl: v.logoUrl || null,
      logoDarkUrl: v.logoDarkUrl || null,
      homepageUrl: v.homepageUrl || null,
      contactUrl: v.contactUrl || null,
    })
  )

  return (
    <div className="grid gap-8">
      <form method="post" onSubmit={onSubmit} className="grid max-w-2xl gap-4">
        <fieldset disabled={!canManage} className="grid gap-4">
          <Field label="Company name" htmlFor="sp-name" error={errors.name?.message}>
            <Input id="sp-name" maxLength={80} {...register("name")} />
          </Field>
          <Field
            label="Subdomain"
            htmlFor="sp-slug"
            help="Your page lives at /status/<subdomain>"
            error={errors.slug?.message}
          >
            <Input id="sp-slug" maxLength={40} {...register("slug")} />
          </Field>
          <Field label="Short note" htmlFor="sp-desc" error={errors.description?.message}>
            <Input id="sp-desc" maxLength={300} {...register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {URL_FIELDS.map((f) => (
              <Field
                key={f.name}
                label={f.label}
                htmlFor={`sp-${f.name}`}
                error={errors[f.name]?.message}
              >
                <Input id={`sp-${f.name}`} placeholder={f.placeholder} {...register(f.name)} />
              </Field>
            ))}
          </div>
          <Controller
            control={control}
            name="theme"
            render={({ field }) => (
              <div className="grid gap-2" role="group" aria-label="Theme">
                <Eyebrow>Theme</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {THEMES.map((t) => (
                    <Chip key={t} selected={field.value === t} onClick={() => field.onChange(t)}>
                      {t}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          />
          <Controller
            control={control}
            name="headerLayout"
            render={({ field }) => (
              <div className="grid gap-2" role="group" aria-label="Header layout">
                <Eyebrow>Header layout</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {HEADER_LAYOUTS.map((l) => (
                    <Chip
                      key={l.value}
                      selected={field.value === l.value}
                      onClick={() => field.onChange(l.value)}
                    >
                      {l.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          />
          <Controller
            control={control}
            name="hideFromSearch"
            render={({ field }) => (
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                Hide this page from search engines
              </label>
            )}
          />
        </fieldset>
        {canManage && (
          <Button type="submit" className="w-fit" disabled={!isDirty || update.isPending}>
            {update.isPending && <Spinner />} Save settings
          </Button>
        )}
      </form>
      {canManage && <DomainPanel workspaceId={workspaceId} page={page} />}
      {canManage && <PasswordPanel workspaceId={workspaceId} page={page} />}
      {canManage && (
        <section className="grid gap-2" aria-label="Delete page">
          <Eyebrow>Danger zone</Eyebrow>
          <ConfirmDialog
            triggerLabel="Delete page"
            title={`Delete ${page.name}?`}
            description="The public address stops working and subscribers stop getting emails. This cannot be undone."
            confirmLabel="Delete page"
            pending={remove.isPending}
            onConfirm={() =>
              remove.mutate(page.id, { onSuccess: () => router.replace("/status-pages") })
            }
          />
        </section>
      )}
    </div>
  )
}
