import type { GitHubSelectView } from '@ape/api-contracts';

type Account = GitHubSelectView['accounts'][number];

/**
 * Compares what each GitHub account has saved for this workspace with what is ticked now.
 * Accounts to connect are saved with the new list; connected accounts with nothing ticked are disconnected.
 */
export function planRepoChanges(accounts: Account[], picked: Record<number, string[]>) {
  const changes = accounts.map((account) => {
    const saved = account.connected ? account.selected : [];
    const now = picked[account.installationId] ?? [];
    return {
      account,
      now,
      added: now.filter((r) => !saved.includes(r)).length,
      removed: saved.filter((r) => !now.includes(r)).length,
    };
  });
  return {
    toConnect: changes.filter((c) => c.now.length > 0 && (c.added > 0 || c.removed > 0)),
    toDisconnect: changes.filter((c) => c.account.connected && c.now.length === 0),
    added: changes.reduce((n, c) => n + c.added, 0),
    removed: changes.reduce((n, c) => n + c.removed, 0),
  };
}
