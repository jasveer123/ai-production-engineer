const NAV = [
  'Overview',
  'Incidents',
  'Services',
  'Investigations',
  'Fixes & PRs',
  'Integrations',
  'Audit log',
  'Settings',
];

export default function Home() {
  return (
    <div className="flex min-h-screen">
      <nav className="w-56 border-r border-black/10 p-4 dark:border-white/10">
        <p className="mb-6 font-semibold">AI Production Engineer</p>
        <ul className="space-y-2 text-sm">
          {NAV.map((item) => (
            <li key={item} className="opacity-80">
              {item}
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-2 text-sm opacity-70">
          Phase 0 skeleton. The dashboard is built in Phase 1.
        </p>
      </main>
    </div>
  );
}
