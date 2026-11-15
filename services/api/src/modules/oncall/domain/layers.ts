import { baseShifts, type OverrideWindow } from './shifts';
import { dayNumber, localDayOf, minutesOf, weekdayOf, zonedToUtc } from './zoned-time';

export type RotationRule =
  | { kind: 'elapsed'; hours: number; anchorAt: string }
  | { kind: 'calendar'; lengthDays: number; startDate: string; handoffTime: string };

export interface Restriction {
  days: number[];
  start: string;
  end: string;
}

export interface Layer {
  id: string;
  name: string;
  rotation: RotationRule;
  participants: string[];
  restrictions: Restriction[];
}

export interface ScheduleRules {
  timezone: string;
  layers: Layer[];
}

export interface CoverageOverride extends OverrideWindow {
  id: string;
}

export interface Segment {
  userId: string;
  startsAt: Date;
  endsAt: Date;
  source: 'layer' | 'override';
  layerId: string | null;
  overrideId: string | null;
}

export interface Gap {
  startsAt: Date;
  endsAt: Date;
}

interface Piece {
  userId: string;
  startsAt: number;
  endsAt: number;
}

function calendarShifts(
  rule: Extract<RotationRule, { kind: 'calendar' }>,
  layer: Layer,
  tz: string,
  from: Date,
  to: Date,
): Piece[] {
  const count = layer.participants.length;
  const start = dayNumber(rule.startDate);
  const minutes = minutesOf(rule.handoffTime);
  const handoff = (k: number) => zonedToUtc(start + k * rule.lengthDays, minutes, tz).getTime();
  let k = Math.floor((localDayOf(from, tz) - start) / rule.lengthDays);
  while (handoff(k) > from.getTime()) k -= 1;
  while (handoff(k + 1) <= from.getTime()) k += 1;
  const out: Piece[] = [];
  for (; handoff(k) < to.getTime(); k += 1)
    out.push({
      userId: layer.participants[((k % count) + count) % count]!,
      startsAt: handoff(k),
      endsAt: handoff(k + 1),
    });
  return out;
}

function rotationShifts(layer: Layer, tz: string, from: Date, to: Date): Piece[] {
  if (layer.participants.length === 0 || to <= from) return [];
  const rule = layer.rotation;
  if (rule.kind === 'calendar') return calendarShifts(rule, layer, tz, from, to);
  return baseShifts(
    {
      anchorAt: new Date(rule.anchorAt),
      rotationHours: rule.hours,
      participants: layer.participants,
    },
    from,
    to,
  ).map((s) => ({ userId: s.userId, startsAt: s.startsAt.getTime(), endsAt: s.endsAt.getTime() }));
}

function restrictionWindows(
  restrictions: Restriction[],
  tz: string,
  from: Date,
  to: Date,
): Piece[] {
  const windows: Piece[] = [];
  for (let day = localDayOf(from, tz) - 1; day <= localDayOf(to, tz) + 1; day += 1) {
    for (const r of restrictions) {
      if (!r.days.includes(weekdayOf(day))) continue;
      const s = minutesOf(r.start);
      const e = minutesOf(r.end);
      const endDay = e > s ? day : day + 1;
      windows.push({
        userId: '',
        startsAt: zonedToUtc(day, s, tz).getTime(),
        endsAt: zonedToUtc(endDay, e, tz).getTime(),
      });
    }
  }
  return windows;
}

function layerPieces(layer: Layer, tz: string, from: Date, to: Date): Piece[] {
  const shifts = rotationShifts(layer, tz, from, to);
  if (layer.restrictions.length === 0) return shifts;
  const windows = restrictionWindows(layer.restrictions, tz, from, to);
  return shifts.flatMap((shift) =>
    windows
      .filter((w) => w.startsAt < shift.endsAt && w.endsAt > shift.startsAt)
      .map((w) => ({
        userId: shift.userId,
        startsAt: Math.max(w.startsAt, shift.startsAt),
        endsAt: Math.min(w.endsAt, shift.endsAt),
      })),
  );
}

const covering = (pieces: Piece[], t: number) =>
  pieces.find((p) => p.startsAt <= t && p.endsAt > t);

function pick(
  layers: Piece[][],
  ids: string[],
  overrides: CoverageOverride[],
  t: number,
): Omit<Segment, 'startsAt' | 'endsAt'> | null {
  const o = overrides.find((x) => x.startsAt.getTime() <= t && x.endsAt.getTime() > t);
  if (o) return { userId: o.userId, source: 'override', layerId: null, overrideId: o.id };
  for (const [i, pieces] of layers.entries()) {
    const hit = covering(pieces, t);
    if (hit) return { userId: hit.userId, source: 'layer', layerId: ids[i]!, overrideId: null };
  }
  return null;
}

/** Layers earlier in the list take precedence; overrides beat every layer. */
export function coverage(
  rules: ScheduleRules,
  overrides: CoverageOverride[],
  from: Date,
  to: Date,
): { segments: Segment[]; gaps: Gap[] } {
  const layers = rules.layers.map((l) => layerPieces(l, rules.timezone, from, to));
  const points = new Set<number>([from.getTime(), to.getTime()]);
  for (const p of layers.flat()) points.add(p.startsAt).add(p.endsAt);
  for (const o of overrides) points.add(o.startsAt.getTime()).add(o.endsAt.getTime());
  const sorted = [...points]
    .filter((p) => p >= from.getTime() && p <= to.getTime())
    .sort((a, b) => a - b);
  const segments: Segment[] = [];
  const gaps: Gap[] = [];
  for (let i = 0; i + 1 < sorted.length; i += 1) {
    const [a, b] = [sorted[i]!, sorted[i + 1]!];
    const who = pick(
      layers,
      rules.layers.map((l) => l.id),
      overrides,
      a,
    );
    const lastSeg = segments.at(-1);
    const lastGap = gaps.at(-1);
    if (!who) {
      if (lastGap && lastGap.endsAt.getTime() === a) lastGap.endsAt = new Date(b);
      else gaps.push({ startsAt: new Date(a), endsAt: new Date(b) });
      continue;
    }
    const same =
      lastSeg &&
      lastSeg.endsAt.getTime() === a &&
      lastSeg.userId === who.userId &&
      lastSeg.source === who.source &&
      lastSeg.layerId === who.layerId &&
      lastSeg.overrideId === who.overrideId;
    if (same) lastSeg.endsAt = new Date(b);
    else segments.push({ ...who, startsAt: new Date(a), endsAt: new Date(b) });
  }
  return { segments, gaps };
}

export function onCallNow(
  rules: ScheduleRules,
  overrides: CoverageOverride[],
  at: Date,
): Segment | null {
  return coverage(rules, overrides, at, new Date(at.getTime() + 1)).segments[0] ?? null;
}
