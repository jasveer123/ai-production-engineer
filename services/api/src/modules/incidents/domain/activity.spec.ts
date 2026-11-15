import { activityEntry, pageActivity } from './activity';

const entry = (id: string, iso: string) =>
  activityEntry({ id, kind: 'comment', at: new Date(iso), summary: id, source: 'user' });

describe('activity paging', () => {
  const all = [
    entry('c', '2026-11-14T10:02:00Z'),
    entry('a', '2026-11-14T10:00:00Z'),
    entry('b', '2026-11-14T10:01:00Z'),
  ];

  it('returns oldest first and walks pages with a cursor', () => {
    const first = pageActivity(all, undefined, 2);
    expect(first.entries.map((e) => e.id)).toEqual(['a', 'b']);
    const second = pageActivity(all, first.nextCursor!, 2);
    expect(second.entries.map((e) => e.id)).toEqual(['c']);
    expect(second.nextCursor).toBeNull();
  });

  it('stays stable when a newer event arrives between page loads', () => {
    const first = pageActivity(all, undefined, 2);
    const grown = [...all, entry('d', '2026-11-14T10:03:00Z')];
    expect(pageActivity(grown, first.nextCursor!, 2).entries.map((e) => e.id)).toEqual(['c', 'd']);
  });
});
