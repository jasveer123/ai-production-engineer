import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { mockApi, renderWithQuery } from '@/test/render';
import { InviteDialog } from './invite-dialog';

const setup = () => {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  renderWithQuery(
    <InviteDialog
      open
      roles={['viewer', 'engineer', 'admin']}
      onClose={onClose}
      onCreated={onCreated}
      workspaceId="ws-1"
    />,
  );
  return { onCreated, onClose };
};

describe('InviteDialog', () => {
  test('is a labelled dialog and starts on the email field', async () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Invite a member' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
  });

  test('rejects a bad email without calling the API', async () => {
    const fetchMock = mockApi([]);
    setup();

    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Create invite' }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('posts the trimmed email and chosen role', async () => {
    const invitation = { id: 'i1', email: 'a@b.co', role: 'admin', inviteUrl: 'https://x/y' };
    const fetchMock = mockApi([[/invitations$/, () => invitation]]);
    const { onCreated } = setup();

    await userEvent.type(screen.getByLabelText('Email'), ' a@b.co ');
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'admin');
    await userEvent.click(screen.getByRole('button', { name: 'Create invite' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(invitation));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ email: 'a@b.co', role: 'admin' });
  });

  test('closes on Escape', async () => {
    const { onClose } = setup();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
