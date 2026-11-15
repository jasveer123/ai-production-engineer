const HOUR_MS = 3_600_000;

export interface Rotation {
  anchorAt: Date;
  rotationHours: number;
  participants: string[];
}

export interface OverrideWindow {
  userId: string;
  startsAt: Date;
  endsAt: Date;
}

export interface Shift {
  userId: string;
  startsAt: Date;
  endsAt: Date;
  override: boolean;
}

export function baseShifts(rotation: Rotation, from: Date, to: Date): Shift[] {
  const count = rotation.participants.length;
  if (count === 0 || to <= from) return [];
  const slot = rotation.rotationHours * HOUR_MS;
  const first = Math.floor((from.getTime() - rotation.anchorAt.getTime()) / slot);
  const shifts: Shift[] = [];
  for (let k = first; rotation.anchorAt.getTime() + k * slot < to.getTime(); k += 1) {
    const startsAt = new Date(rotation.anchorAt.getTime() + k * slot);
    shifts.push({
      userId: rotation.participants[((k % count) + count) % count]!,
      startsAt,
      endsAt: new Date(startsAt.getTime() + slot),
      override: false,
    });
  }
  return shifts;
}

function layer(shift: Shift, overrides: OverrideWindow[]): Shift[] {
  const hits = overrides
    .filter((o) => o.startsAt < shift.endsAt && o.endsAt > shift.startsAt)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const pieces: Shift[] = [];
  let cursor = shift.startsAt;
  for (const o of hits) {
    const start = o.startsAt > cursor ? o.startsAt : cursor;
    const end = o.endsAt < shift.endsAt ? o.endsAt : shift.endsAt;
    if (start > cursor) pieces.push({ ...shift, startsAt: cursor, endsAt: start });
    pieces.push({ userId: o.userId, startsAt: start, endsAt: end, override: true });
    cursor = end;
  }
  if (cursor < shift.endsAt) pieces.push({ ...shift, startsAt: cursor });
  return pieces;
}

function merge(shifts: Shift[]): Shift[] {
  const out: Shift[] = [];
  for (const s of shifts) {
    const last = out[out.length - 1];
    if (
      last &&
      last.override &&
      s.override &&
      last.userId === s.userId &&
      last.endsAt.getTime() === s.startsAt.getTime()
    ) {
      last.endsAt = s.endsAt;
    } else out.push({ ...s });
  }
  return out;
}

export function shiftsBetween(
  rotation: Rotation,
  overrides: OverrideWindow[],
  from: Date,
  to: Date,
): Shift[] {
  return merge(baseShifts(rotation, from, to).flatMap((shift) => layer(shift, overrides)));
}

export function onCallAt(rotation: Rotation, overrides: OverrideWindow[], at: Date): Shift | null {
  const end = new Date(at.getTime() + 1);
  return (
    shiftsBetween(rotation, overrides, at, end).find((s) => s.startsAt <= at && s.endsAt > at) ??
    null
  );
}
