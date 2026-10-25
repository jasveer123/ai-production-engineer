import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { mockApi, renderWithQuery } from '@/test/render';
import { LimitsForm } from './limits-form';

const LIMITS = { monthlyAiBudgetUsd: 25, maxConcurrentInvestigations: null };

describe('LimitsForm', () => {
  test('shows the saved limits and blocks a negative budget with a message', async () => {
    const fetchMock = mockApi([]);
    renderWithQuery(<LimitsForm limits={LIMITS} canEdit workspaceId="ws-1" onSaved={vi.fn()} />);

    const budget = screen.getByLabelText('Monthly AI budget (USD)');
    expect(budget).toHaveValue(25);

    await userEvent.clear(budget);
    await userEvent.type(budget, '-3');
    await userEvent.click(screen.getByRole('button', { name: 'Save limits' }));

    expect(await screen.findByText(/Enter a budget of 0 or more/)).toBeInTheDocument();
    expect(budget).toBeInvalid();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('empty fields are sent as no limit', async () => {
    const onSaved = vi.fn();
    const fetchMock = mockApi([[/usage\/limits$/, () => ({ months: [] })]]);
    renderWithQuery(<LimitsForm limits={LIMITS} canEdit workspaceId="ws-1" onSaved={onSaved} />);

    await userEvent.clear(screen.getByLabelText('Monthly AI budget (USD)'));
    await userEvent.click(screen.getByRole('button', { name: 'Save limits' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      monthlyAiBudgetUsd: null,
      maxConcurrentInvestigations: null,
    });
  });

  test('is read-only without the owner role', () => {
    renderWithQuery(
      <LimitsForm limits={LIMITS} canEdit={false} workspaceId="ws-1" onSaved={vi.fn()} />,
    );
    expect(screen.getByLabelText('Monthly AI budget (USD)')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save limits' })).not.toBeInTheDocument();
  });
});
