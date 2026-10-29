'use client';

import { inviteMemberSchema, type InvitationWithLink, type Role } from '@ape/api-contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { ROLE_LABEL } from '@/features/auth';
import { api, errorMessage } from '@/lib/api';
import { useZodForm } from '@/lib/use-zod-form';

type InviteDialogProps = {
  open: boolean;
  roles: Role[];
  onClose: () => void;
  onCreated: (inv: InvitationWithLink) => void;
  workspaceId: string;
};

export function InviteDialog({ open, roles, onClose, onCreated, workspaceId }: InviteDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const form = useZodForm(inviteMemberSchema, { defaultValues: { email: '', role: 'engineer' } });
  const emailError = form.formState.errors.email?.message;
  const invite = useMutation({
    mutationFn: (body: { email: string; role: Role }) =>
      api<InvitationWithLink>(`/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        json: body,
      }),
    onSuccess: (inv) => {
      form.reset();
      onCreated(inv);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite a member"
      description="They get a link to register or sign in. Their role applies as soon as they join."
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setError(null);
          invite.mutate(values);
        })}
      >
        <Field id="invite-email" label="Email" error={emailError}>
          <Input
            id="invite-email"
            type="email"
            autoFocus
            invalid={Boolean(emailError)}
            {...form.register('email', { setValueAs: (v: string) => v.trim() })}
          />
        </Field>
        <Field
          id="invite-role"
          label="Role"
          hint="Engineers approve fixes. Admins also manage members and integrations."
        >
          <Select id="invite-role" {...form.register('role')}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <FormError>{error}</FormError>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? 'Inviting…' : 'Create invite'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
