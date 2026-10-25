/**
 * Repositories to offer for a service: every connected one, sorted, plus the service's current
 * repository when no installation can read it any more, so editing never silently drops it.
 */
export function repoOptions(connected: string[], current: string | null): string[] {
  const all = new Set(connected);
  if (current) all.add(current);
  return [...all].sort((a, b) => a.localeCompare(b));
}

/**
 * A repository to suggest for a service name seen in telemetry, or null. It only suggests when
 * exactly one repository's name matches (`demo-shop-api` → `me/demo-shop`), so an ambiguous
 * name is never guessed (FR-03). The person still confirms before anything is saved.
 */
export function suggestRepo(serviceName: string, repos: string[]): string | null {
  const service = serviceName.toLowerCase();
  const matches = repos.filter((full) => {
    const repo = (full.split('/').pop() ?? '').toLowerCase();
    return (
      repo !== '' &&
      (service === repo || service.startsWith(`${repo}-`) || repo.startsWith(`${service}-`))
    );
  });
  return matches.length === 1 ? matches[0]! : null;
}

/**
 * Service names to offer for a repository: the one already linked to it first, then telemetry
 * names that point at it, then the repository's own name, then every other known service.
 * The first entry is the pre-filled default.
 */
export function serviceNamesFor(
  repo: string,
  mapped: { name: string; repositoryFullName: string | null }[],
  discovered: string[],
  allRepos: string[],
): string[] {
  const linked = mapped.filter((s) => s.repositoryFullName === repo).map((s) => s.name);
  const pointing = discovered.filter((n) => suggestRepo(n, allRepos) === repo);
  const own = (repo.split('/').pop() ?? '').toLowerCase();
  const rest = [...mapped.map((s) => s.name), ...discovered];
  return [...new Set([...linked, ...pointing, ...(own ? [own] : []), ...rest])];
}
