export function repoOptions(connected: string[], current: string | null): string[] {
  const all = new Set(connected);
  if (current) all.add(current);
  return [...all].sort((a, b) => a.localeCompare(b));
}

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
