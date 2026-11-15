import type { ActivityEntry, ActivityPage } from '@ape/api-contracts';

type EntryInput = Partial<Omit<ActivityEntry, 'at'>> &
  Pick<ActivityEntry, 'id' | 'kind' | 'summary' | 'source'> & { at: Date };

export const activityEntry = (e: EntryInput): ActivityEntry => ({
  actor: null,
  editable: false,
  body: null,
  region: null,
  statusCode: null,
  channel: null,
  address: null,
  deliveryStatus: null,
  sourceUrl: null,
  attributes: {},
  ...e,
  at: e.at.toISOString(),
});

const keyOf = (e: Pick<ActivityEntry, 'at' | 'id'>) => `${e.at}|${e.id}`;

// Oldest first with a (time, id) cursor, so new events only ever append and pages stay stable.
export function pageActivity(
  entries: ActivityEntry[],
  after: string | undefined,
  limit: number,
): ActivityPage {
  const sorted = [...entries].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  const rest = after ? sorted.filter((e) => keyOf(e) > after) : sorted;
  const page = rest.slice(0, limit);
  const last = page[page.length - 1];
  return { entries: page, nextCursor: rest.length > limit && last ? keyOf(last) : null };
}
