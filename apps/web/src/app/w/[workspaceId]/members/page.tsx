'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { inviteMemberSchema, ROLES, type InviteMemberInput, type Role } from '@ape/api-contracts';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
  Table,
  Td,
} from '@/components/ui';
import {
  useInvitations,
  useInvite,
  useMe,
  useMembers,
  useRemoveMember,
  useRevokeInvitation,
  useUpdateMemberRole,
  useWorkspace,
} from '@/lib/queries';
import { atLeast } from '@/lib/roles';

export default function MembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const me = useMe();
  const ws = useWorkspace(workspaceId);
  const members = useMembers(workspaceId);
  const canManage = atLeast(ws.data?.role, 'admin');
  const isOwner = ws.data?.role === 'owner';
  const invitations = useInvitations(workspaceId, canManage);
  const invite = useInvite(workspaceId);
  const revoke = useRevokeInvitation(workspaceId);
  const updateRole = useUpdateMemberRole(workspaceId);
  const removeMember = useRemoveMember(workspaceId);
  // Admins can't grant the owner role; the API rejects it too.
  const grantable: readonly Role[] = isOwner ? ROLES : ROLES.filter((r) => r !== 'owner');

  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { role: 'viewer' },
  });

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Members"
        description="Who can access this workspace, and what they can do."
      />

      {canManage && (
        <Card className="mb-6 p-4">
          <form
            onSubmit={form.handleSubmit(async (v) => {
              await invite.mutateAsync(v);
              form.reset({ email: '', role: v.role });
            })}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-60 flex-1">
              <Field label="Invite by email" error={form.formState.errors.email?.message}>
                <Input
                  type="email"
                  placeholder="teammate@example.com"
                  {...form.register('email')}
                />
              </Field>
            </div>
            <Field label="Role">
              <Select {...form.register('role')}>
                {grantable.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={invite.isPending}>
              Send invite
            </Button>
          </form>
          <p className="mt-2 text-xs text-subtle">
            They join automatically the next time they sign in with that email.
          </p>
          <div className="mt-2">
            <ErrorBox error={invite.error} />
          </div>
        </Card>
      )}

      <Card>
        {members.isPending ? (
          <Loading />
        ) : members.error ? (
          <div className="p-4">
            <ErrorBox error={members.error} />
          </div>
        ) : (
          <Table head={['Member', 'Role', 'Joined', '']}>
            {members.data.map((m) => {
              const self = m.userId === me.data?.user.id;
              const editable = canManage && !self && (isOwner || m.role !== 'owner');
              return (
                <tr key={m.id}>
                  <Td>
                    <p className="font-medium">{m.name ?? m.email}</p>
                    {m.name && <p className="text-xs text-subtle">{m.email}</p>}
                  </Td>
                  <Td>
                    {editable ? (
                      <Select
                        aria-label={`Role for ${m.email}`}
                        className="h-8 w-32"
                        value={m.role}
                        disabled={updateRole.isPending}
                        onChange={(e) =>
                          updateRole.mutate({ id: m.id, role: e.target.value as Role })
                        }
                      >
                        {grantable.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge tone={m.role}>{m.role}</Badge>
                    )}
                    {self && <span className="ml-2 text-xs text-subtle">you</span>}
                  </Td>
                  <Td className="text-subtle">{new Date(m.createdAt).toLocaleDateString()}</Td>
                  <Td className="text-right">
                    {editable && (
                      <Button
                        variant="danger"
                        className="h-8"
                        disabled={removeMember.isPending}
                        onClick={() => removeMember.mutate(m.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      <div className="mt-3 flex flex-col gap-2">
        <ErrorBox error={updateRole.error} />
        <ErrorBox error={removeMember.error} />
      </div>

      {canManage && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-semibold">Pending invitations</h2>
          <Card>
            {invitations.isPending ? (
              <Loading />
            ) : !invitations.data?.length ? (
              <EmptyState title="No pending invitations" />
            ) : (
              <Table head={['Email', 'Role', 'Sent', '']}>
                {invitations.data.map((i) => (
                  <tr key={i.id}>
                    <Td>{i.email}</Td>
                    <Td>
                      <Badge tone={i.role}>{i.role}</Badge>
                    </Td>
                    <Td className="text-subtle">{new Date(i.createdAt).toLocaleDateString()}</Td>
                    <Td className="text-right">
                      <Button variant="ghost" className="h-8" onClick={() => revoke.mutate(i.id)}>
                        Revoke
                      </Button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
