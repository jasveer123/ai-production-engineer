'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  createWorkspaceSchema,
  type CreateWorkspaceInput,
  type Workspace,
} from '@ape/api-contracts';
import { Button, Card, ErrorBox, Field, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { keys, useMe } from '@/lib/queries';

export default function NewWorkspacePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const form = useForm<CreateWorkspaceInput>({ resolver: zodResolver(createWorkspaceSchema) });

  const submit = async (values: CreateWorkspaceInput) => {
    try {
      const ws = await api<Workspace>('/workspaces', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      await qc.invalidateQueries({ queryKey: keys.me });
      router.push(`/w/${ws.id}`);
    } catch (err) {
      form.setError('root', {
        message: err instanceof Error ? err.message : 'Could not create workspace',
      });
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Create a workspace</h1>
        <p className="mt-1 text-sm text-subtle">
          You will be its owner. You can invite your team next.
        </p>
        <form onSubmit={form.handleSubmit(submit)} className="mt-6 flex flex-col gap-4">
          <Field label="Workspace name" error={form.formState.errors.name?.message}>
            <Input autoFocus placeholder="Acme production" {...form.register('name')} />
          </Field>
          {form.formState.errors.root && (
            <ErrorBox error={new Error(form.formState.errors.root.message)} />
          )}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Create workspace
          </Button>
          {me.data && me.data.workspaces.length > 0 && (
            <Link href="/" className="text-center text-sm text-subtle hover:underline">
              Back to my workspaces
            </Link>
          )}
        </form>
      </Card>
    </main>
  );
}
