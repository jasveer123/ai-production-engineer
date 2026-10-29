export type StepState = 'done' | 'current' | 'todo';
export type SetupStepId = 'code' | 'data' | 'services' | 'incident';
export type SetupStep = { id: SetupStepId; title: string; detail: string; state: StepState };

export type SetupInput = {
  githubConnected: boolean;

  sendingServices: string[];

  servicesSetUp: number;
  servicesWithoutRepo: number;

  discoveredNotSetUp: string[];
  incidents: number;
};

export function setupSteps(i: SetupInput): SetupStep[] {
  const steps: Omit<SetupStep, 'state'>[] = [
    {
      id: 'code',
      title: 'Connect your code',
      detail: i.githubConnected
        ? 'GitHub is connected.'
        : 'Connect GitHub so the AI can read code and open fix pull requests.',
    },
    {
      id: 'data',
      title: 'Send data from your app',
      detail: i.sendingServices.length
        ? `Receiving from ${i.sendingServices.slice(0, 3).join(', ')}${i.sendingServices.length > 3 ? ` and ${i.sendingServices.length - 3} more` : ''}.`
        : 'Create a workspace token and send logs, traces or errors.',
    },
    {
      id: 'services',
      title: 'Link each service to its repository',
      detail: i.discoveredNotSetUp.length
        ? `${i.discoveredNotSetUp.length} sending data but not set up yet, e.g. ${i.discoveredNotSetUp[0]}.`
        : i.servicesWithoutRepo
          ? `${i.servicesWithoutRepo} service${i.servicesWithoutRepo === 1 ? ' has' : 's have'} no repository yet.`
          : i.servicesSetUp
            ? 'Every service has its repository.'
            : 'Services appear here once data arrives.',
    },
    {
      id: 'incident',
      title: 'See your first incident',
      detail: i.incidents
        ? 'Incidents are being detected and investigated.'
        : 'Errors from your services open incidents on their own.',
    },
  ];
  const done: Record<SetupStepId, boolean> = {
    code: i.githubConnected,
    data: i.sendingServices.length > 0,
    services:
      i.servicesSetUp > 0 && i.servicesWithoutRepo === 0 && i.discoveredNotSetUp.length === 0,
    incident: i.incidents > 0,
  };
  const current = steps.find((s) => !done[s.id])?.id;
  return steps.map((s) => ({
    ...s,
    state: done[s.id] ? 'done' : s.id === current ? 'current' : 'todo',
  }));
}
