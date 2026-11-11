"use client"

import * as React from "react"
import { Button, Field, Input, Spinner } from "@/components/ui"
import { ConfirmDialog } from "@/components/shared"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { notifyError } from "@/lib/toast"
import { useRemoveSourceMap, useSourceMaps, useUploadSourceMap } from "../hooks"

interface SourceMapsPanelProps {
  workspaceId: string
  canEdit: boolean
}

export function SourceMapsPanel({ workspaceId, canEdit }: SourceMapsPanelProps) {
  const maps = useSourceMaps(workspaceId)
  const upload = useUploadSourceMap(workspaceId)
  const remove = useRemoveSourceMap(workspaceId)
  const [release, setRelease] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [target, setTarget] = React.useState("")

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file || !release.trim()) return
    try {
      const map = await file.text()
      upload.mutate(
        {
          release: release.trim(),
          file: target.trim() || file.name.replace(/\.map$/, ""),
          map,
        },
        { onSuccess: () => setFile(null) }
      )
    } catch (error) {
      notifyError(error)
    }
  }

  return (
    <div className="grid gap-5">
      <p className="max-w-prose text-[0.8125rem] leading-5 text-muted-foreground">
        Upload the source map of each build. Stack traces from that release then show your original
        files and line numbers.
      </p>
      {canEdit && (
        <form
          method="post"
          onSubmit={submit}
          className="grid max-w-xl gap-3 border border-line p-4"
        >
          <Field label="Release" htmlFor="map-release">
            <Input
              id="map-release"
              value={release}
              onChange={(e) => setRelease(e.target.value)}
              placeholder="1.4.2"
            />
          </Field>
          <Field label="Source map file (.map)" htmlFor="map-file">
            <Input
              id="map-file"
              type="file"
              accept=".map,.json"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label="Built file name (optional)" htmlFor="map-target">
            <Input
              id="map-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="app.min.js"
            />
          </Field>
          <Button
            type="submit"
            size="sm"
            className="w-fit"
            disabled={!file || !release.trim() || upload.isPending}
          >
            {upload.isPending && <Spinner />} Upload
          </Button>
        </form>
      )}
      <ul className="grid gap-2">
        {(maps.data ?? []).map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 border border-line bg-panel p-3 text-sm"
          >
            <span>
              <span className="font-mono">{item.file}</span>{" "}
              <span className="text-muted-foreground">
                release {item.release} · {(item.sizeBytes / 1024).toFixed(0)} KB ·{" "}
                {formatRelativeTime(item.createdAt)}
              </span>
            </span>
            {canEdit && (
              <ConfirmDialog
                triggerLabel="Delete"
                title={`Delete ${item.file}?`}
                description="Stack traces for this release show built file positions again."
                confirmLabel="Delete source map"
                pending={remove.isPending}
                onConfirm={() => remove.mutate(item.id)}
              />
            )}
          </li>
        ))}
        {(maps.data ?? []).length === 0 && (
          <li className="border border-dashed border-line p-6 text-center text-sm text-muted-foreground">
            No source maps uploaded.
          </li>
        )}
      </ul>
    </div>
  )
}
