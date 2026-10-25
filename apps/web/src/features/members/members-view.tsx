'use client';

import {
  ROLES,
  type Invitation,
  type InvitationWithLink,
  type Member,
  type Role,
} from '@ape/api-contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { TokenField } from '@/components/ui/code-snippet';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { assignableRoles, ROLE_LABEL } from '@/features/auth/roles';
import { useSession } from '@/features/auth/session';
import { ROLE_RIGHTS } from '@/features/workspace/fixtures';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export function MembersView() {
  const { workspace, role, can, me } = useSession();
  const ws = workspace.id;
  const qc = useQueryClient();
  const isAdmin = can('admin');
  const members = useQuery({
    queryKey: ['ws', ws, 'members'],
    queryFn: () => api<Member[]>(`/workspaces/${ws}/members`),
  });
  const invitations = useQuery({
    queryKey: ['ws', ws, 'invitations'],
    queryFn: () => api<Invitation[]>(`/workspaces/${ws}/invitations`),
    enabled: isAdmin,
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [created, setCreated] = useState<InvitationWithLink | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['ws', ws] });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      api(`/workspaces/${ws}/members/${id}`, { method: 'PATCH', json: { role } }),
    onSuccess: () => (setActionError(null), refresh()),
    onError: (e) => setActionError(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/workspaces/${ws}/members/${id}`, { method: 'DELETE' }),
    onSuccess: () => (setActionError(null), refresh()),
    onError: (e) => setActionError(errorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/workspaces/${ws}/invitations/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: (e) => setActionError(errorMessage(e)),
  });

  const options = assignableRoles(role);
  const canChange = (m: Member) =>
    isAdmin && m.userId !== me.user.id && (role === 'owner' || m.role !== 'owner');

  return (
    <>
      <PageHeader
        title="Members"
        description="People in this workspace and what each role can do."
        actions={
          isAdmin ? (
            <Button onClick={() => setInviteOpen(true)}>Invite member</Button>
          ) : (
            <span className="text-[13px] text-ink-muted">Only admins can invite people.</span>
          )
        }
      />
      {actionError && (
        <Banner tone="danger" title="That did not work.">
          {actionError}
        </Banner>
      )}
      {created && (
        <Card as="section" className="grid gap-3">
          <CardHeader
            eyebrow="Invitation created"
            title={`Send this link to ${created.email}`}
            aside={
              <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>
                Done
              </Button>
            }
          />
          <TokenField
            label="Invite link"
            masked={created.inviteUrl}
            full={created.inviteUrl}
            help="We also emailed it. It works once and expires in 7 days. It is not shown again."
          />
        </Card>
      )}

      {members.isPending ? (
        <p className="text-ink-muted">Loading members…</p>
      ) : members.isError ? (
        <Banner tone="danger" title="Could not load members.">
          {errorMessage(members.error)}
        </Banner>
      ) : (
        <Table label="Members">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Joined</Th>
              {isAdmin && <Th className="text-right">Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {members.data.map((m) => (
              <Tr key={m.id}>
                <Td>
                  <div className="font-semibold">
                    {m.name ?? m.email}
                    {m.userId === me.user.id && (
                      <span className="ml-1 font-normal text-ink-muted">(you)</span>
                    )}
                  </div>
                  <div className="text-[13px] text-ink-muted">{m.email}</div>
                </Td>
                <Td>
                  {canChange(m) ? (
                    <Select
                      aria-label={`Role for ${m.email}`}
                      value={m.role}
                      disabled={changeRole.isPending}
                      onChange={(e) =>
                        changeRole.mutate({ id: m.id, role: e.target.value as Role })
                      }
                      className="h-8 w-36"
                    >
                      {(options.includes(m.role) ? options : [m.role, ...options]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Badge tone={m.role === 'owner' ? 'brand' : 'neutral'} icon={null}>
                      {ROLE_LABEL[m.role]}
                    </Badge>
                  )}
                </Td>
                <Td className="text-ink-muted">{formatDateTime(m.createdAt)}</Td>
                {isAdmin && (
                  <Td className="text-right">
                    {canChange(m) && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={remove.isPending}
                        onClick={() =>
                          window.confirm(
                            `Remove ${m.email} from ${workspace.name}? They lose access at once.`,
                          ) && remove.mutate(m.id)
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </Td>
                )}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {isAdmin && (invitations.data?.length ?? 0) > 0 && (
        <Table label="Pending invitations">
          <thead>
            <tr>
              <Th>Pending invitation</Th>
              <Th>Role</Th>
              <Th>Expires</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {invitations.data!.map((i) => (
              <Tr key={i.id}>
                <Td>{i.email}</Td>
                <Td>{ROLE_LABEL[i.role]}</Td>
                <Td className="text-ink-muted">
                  {i.expiresAt ? formatDateTime(i.expiresAt) : 'On next sign-in'}
                </Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(i.id)}
                  >
                    Revoke
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Card as="section">
        <CardHeader eyebrow="Roles" title="Who can do what" />
        <dl className="mt-3 grid gap-3">
          {ROLE_RIGHTS.map((r) => (
            <div
              key={r.role}
              className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0"
            >
              <dt className="font-semibold">{r.role}</dt>
              <dd className="text-ink-muted">{r.can}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <InviteDialog
        open={inviteOpen}
        roles={options.length ? options : [...ROLES]}
        onClose={() => setInviteOpen(false)}
        onCreated={(inv) => {
          setCreated(inv);
          setInviteOpen(false);
          void refresh();
        }}
        workspaceId={ws}
      />
    </>
  );
}

function InviteDialog({
  open,
  roles,
  onClose,
  onCreated,
  workspaceId,
}: {
  open: boolean;
  roles: Role[];
  onClose: () => void;
  onCreated: (inv: InvitationWithLink) => void;
  workspaceId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: (body: { email: string; role: Role }) =>
      api<InvitationWithLink>(`/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        json: body,
      }),
    onSuccess: onCreated,
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
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const f = new FormData(e.currentTarget);
          invite.mutate({ email: String(f.get('email')).trim(), role: f.get('role') as Role });
        }}
      >
        <Field id="invite-email" label="Email">
          <Input id="invite-email" name="email" type="email" required autoFocus />
        </Field>
        <Field
          id="invite-role"
          label="Role"
          hint="Engineers approve fixes. Admins also manage members and integrations."
        >
          <Select id="invite-role" name="role" defaultValue="engineer">
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
