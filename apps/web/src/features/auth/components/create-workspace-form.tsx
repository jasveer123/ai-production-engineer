"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button, Field, Input, Spinner } from "@/components/ui"
import { useCreateWorkspace, useLogout } from "../hooks"
import { createWorkspaceSchema, type CreateWorkspaceValues } from "../schemas"
import { AuthFormCard } from "./auth-form-card"

interface CreateWorkspaceFormProps {
  email: string
}

export function CreateWorkspaceForm({ email }: CreateWorkspaceFormProps) {
  const createWorkspace = useCreateWorkspace()
  const logout = useLogout()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: "" },
  })

  const onSubmit = handleSubmit((values) =>
    createWorkspace.mutateAsync(values).then(
      () => undefined,
      () => undefined
    )
  )

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <AuthFormCard
        eyebrow="One last step"
        title="Create your workspace"
        subtitle={
          <>
            Signed in as {email}.{" "}
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="text-brand underline underline-offset-3 hover:text-brand-strong"
            >
              Use another account
            </button>
          </>
        }
      >
        <form method="post" onSubmit={onSubmit} noValidate className="grid gap-4">
          <Field
            label="Workspace name"
            htmlFor="workspace-name"
            help="Usually your company or product. You can change it later."
            error={errors.name?.message}
          >
            <Input
              id="workspace-name"
              placeholder="Acme Shop"
              autoFocus
              aria-invalid={!!errors.name}
              {...register("name")}
            />
          </Field>
          <Button type="submit" className="w-full" disabled={createWorkspace.isPending}>
            {createWorkspace.isPending && (
              <Spinner className="border-on-brand/40 border-t-on-brand" />
            )}{" "}
            Create workspace
          </Button>
        </form>
      </AuthFormCard>
    </div>
  )
}
