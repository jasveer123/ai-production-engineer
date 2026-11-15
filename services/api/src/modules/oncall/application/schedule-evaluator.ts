import type {
  CoverageGap,
  CoverageInterval,
  LayerInput,
  OncallPerson,
  OncallShift,
} from '@ape/api-contracts';
import type { oncallOverrides, oncallSchedules, StoredLayer } from '../../../core/db/schema';
import { coverage, type Layer, type ScheduleRules } from '../domain/layers';

type ScheduleRow = typeof oncallSchedules.$inferSelect;
type OverrideRow = typeof oncallOverrides.$inferSelect;

export interface ResolvedCoverage {
  intervals: CoverageInterval[];
  gaps: CoverageGap[];
}

export function rulesOf(row: ScheduleRow): ScheduleRules {
  const layers: Layer[] = row.layers.length
    ? row.layers
    : [
        {
          id: 'default',
          name: 'Rotation',
          rotation: {
            kind: 'elapsed',
            hours: row.rotationHours,
            anchorAt: row.anchorAt.toISOString(),
          },
          participants: row.participants,
          restrictions: [],
        },
      ];
  return { timezone: row.timezone, layers };
}

export function storedLayers(input: LayerInput[]): StoredLayer[] {
  return input.map((l) => ({
    id: l.id,
    name: l.name,
    rotation: l.rotation,
    participants: [...new Set(l.participantIds)],
    restrictions: l.restrictions ?? [],
  }));
}

export const participantIdsOf = (rules: ScheduleRules) => [
  ...new Set(rules.layers.flatMap((l) => l.participants)),
];

function mergeGaps(gaps: CoverageGap[]): CoverageGap[] {
  const sorted = [...gaps].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const out: CoverageGap[] = [];
  for (const g of sorted) {
    const last = out.at(-1);
    if (last && last.endsAt >= g.startsAt)
      last.endsAt = last.endsAt > g.endsAt ? last.endsAt : g.endsAt;
    else out.push({ ...g });
  }
  return out;
}

/** The single evaluator used by schedule views, coverage, calendar export and paging. */
export function resolveCoverage(
  rules: ScheduleRules,
  overrides: OverrideRow[],
  people: Map<string, OncallPerson>,
  range: { from: Date; to: Date },
): ResolvedCoverage {
  const windows = overrides.map((o) => ({
    id: o.id,
    userId: o.userId,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
  }));
  const result = coverage(rules, windows, range.from, range.to);
  const names = new Map(rules.layers.map((l) => [l.id, l.name]));
  const intervals: CoverageInterval[] = [];
  const gaps: CoverageGap[] = result.gaps.map((g) => ({
    startsAt: g.startsAt.toISOString(),
    endsAt: g.endsAt.toISOString(),
  }));
  for (const s of result.segments) {
    const span = { startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() };
    const person = people.get(s.userId);
    if (!person) {
      gaps.push(span);
      continue;
    }
    intervals.push({
      person,
      ...span,
      source: s.source,
      layerId: s.layerId,
      layerName: s.layerId ? (names.get(s.layerId) ?? null) : null,
    });
  }
  return { intervals, gaps: mergeGaps(gaps) };
}

export const toShift = (i: CoverageInterval): OncallShift => ({
  person: i.person,
  startsAt: i.startsAt,
  endsAt: i.endsAt,
  override: i.source === 'override',
});
