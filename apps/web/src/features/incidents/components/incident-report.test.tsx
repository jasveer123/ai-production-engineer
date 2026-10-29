import type { IncidentInvestigation } from '@ape/api-contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { mockApi, renderWithQuery, TEST_SESSION } from '@/test/render';
import { IncidentReport } from './incident-report';

let canEngineer = true;
vi.mock('@/features/auth/session', () => ({
  useSession: () => ({ ...TEST_SESSION, can: () => canEngineer }),
  useWorkspaceId: () => TEST_SESSION.workspace.id,
}));

const investigation = (patch: Partial<NonNullable<IncidentInvestigation['latest']>> = {}) =>
  ({
    latest: {
      id: 'inv-1',
      attempt: 1,
      status: 'completed',
      statusReason: null,
      model: 'test-model',
      promptVersion: 'v1',
      coverage: {},
      observations: [{ statement: 'Checkout throws a TypeError', evidence: ['E1'] }],
      dataGaps: ['No deploy markers for the last hour'],
      rejectedCount: 1,
      usage: { cost_usd: 0.1234 },
      requestNote: null,
      startedAt: null,
      completedAt: null,
      evidence: [
        {
          id: 'e1',
          ref: 'E1',
          kind: 'error_event',
          title: 'TypeError in cart.ts',
          sourceReference: 'evt_1',
          sourceUrl: null,
        },
      ],
      hypotheses: [
        {
          id: 'h1',
          rank: 1,
          summary: 'Cart total is read before it is set',
          confidence: 'high',
          confidenceRationale: null,
          supportingEvidence: ['E1'],
          contradictingEvidence: [],
          missingInformation: [],
          suspectedLocation: null,
          feedback: { correct: 0, partly: 0, wrong: 0, mine: null },
        },
      ],
      ...patch,
    },
    attempts: 1,
    workflow: null,
    reproductionApproved: false,
  }) satisfies IncidentInvestigation;

describe('IncidentReport', () => {
  test('shows observations, gaps, ranked hypotheses and cost', async () => {
    canEngineer = true;
    mockApi([[/investigation$/, () => investigation()]]);
    renderWithQuery(<IncidentReport id="inc-1" />);

    expect(await screen.findByText('Cart total is read before it is set')).toBeInTheDocument();
    expect(screen.getByText(/Checkout throws a TypeError/)).toBeInTheDocument();
    expect(screen.getByText('No deploy markers for the last hour')).toBeInTheDocument();
    expect(screen.getByText('high confidence')).toBeInTheDocument();
    expect(screen.getByText(/1 claim without evidence removed/)).toBeInTheDocument();
  });

  test('asks the API to start an investigation when none exists', async () => {
    canEngineer = true;
    const fetchMock = mockApi([
      [
        /investigation$/,
        () => ({ latest: null, attempts: 0, workflow: null, reproductionApproved: false }),
      ],
      [/actions$/, () => ({})],
    ]);
    renderWithQuery(<IncidentReport id="inc-1" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Start investigation' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/actions'));
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        action: 'investigate',
      });
    });
  });

  test('viewers can read the report but get no action buttons', async () => {
    canEngineer = false;
    mockApi([[/investigation$/, () => investigation()]]);
    renderWithQuery(<IncidentReport id="inc-1" />);

    await screen.findByText('Cart total is read before it is set');
    expect(screen.queryByRole('button', { name: 'Approve reproduction' })).not.toBeInTheDocument();
  });

  test('a failed load says so instead of staying blank', async () => {
    mockApi([
      [
        /investigation$/,
        () =>
          new Response(JSON.stringify({ code: 'internal_error', message: 'Down' }), {
            status: 500,
          }),
      ],
    ]);
    renderWithQuery(<IncidentReport id="inc-1" />);
    expect(await screen.findByText('Could not load the report.')).toBeInTheDocument();
  });
});
