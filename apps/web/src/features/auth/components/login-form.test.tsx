import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mockApi, renderWithQuery } from '@/test/render';
import { LoginForm } from './login-form';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => replace.mockClear());

const ME = { user: { id: 'u1' }, workspaces: [{ id: 'ws-1' }], authProviders: {} };

describe('LoginForm', () => {
  test('asks for email and password before calling the API', async () => {
    const fetchMock = mockApi([[/auth\/providers$/, () => ({})]]);
    renderWithQuery(<LoginForm />);

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInvalid();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/login'))).toBe(false);
  });

  test('signs in and moves on', async () => {
    mockApi([
      [/auth\/providers$/, () => ({})],
      [/auth\/login$/, () => ME],
    ]);
    renderWithQuery(<LoginForm />);

    await userEvent.type(screen.getByLabelText('Email'), 'Owner@Demo.local');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  test('shows the API message when the credentials are wrong', async () => {
    mockApi([
      [/auth\/providers$/, () => ({})],
      [
        /auth\/login$/,
        () =>
          new Response(
            JSON.stringify({ code: 'unauthorized', message: 'Wrong email or password' }),
            {
              status: 401,
            },
          ),
      ],
    ]);
    renderWithQuery(<LoginForm />);

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password');
    expect(replace).not.toHaveBeenCalled();
  });
});
