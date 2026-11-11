import { onCallAt, shiftsBetween, type OverrideWindow, type Rotation } from './domain/shifts';

const at = (iso: string) => new Date(iso);
const rotation: Rotation = {
  anchorAt: at('2026-01-05T09:00:00Z'),
  rotationHours: 168,
  participants: ['ana', 'bo', 'cy'],
};

describe('on-call shifts', () => {
  it('rotates through the participants one week at a time', () => {
    const shifts = shiftsBetween(
      rotation,
      [],
      at('2026-01-05T09:00:00Z'),
      at('2026-01-26T09:00:00Z'),
    );
    expect(shifts.map((s) => s.userId)).toEqual(['ana', 'bo', 'cy']);
    expect(shifts[0]!.endsAt.toISOString()).toBe('2026-01-12T09:00:00.000Z');
    expect(shifts.every((s) => !s.override)).toBe(true);
  });

  it('wraps back to the first person and works before the start date', () => {
    expect(onCallAt(rotation, [], at('2026-01-26T09:00:00Z'))!.userId).toBe('ana');
    expect(onCallAt(rotation, [], at('2026-01-04T09:00:00Z'))!.userId).toBe('cy');
    expect(onCallAt(rotation, [], at('2026-01-05T08:59:59Z'))!.userId).toBe('cy');
  });

  it('includes the shift that is already running at the start of the window', () => {
    const shifts = shiftsBetween(
      rotation,
      [],
      at('2026-01-08T00:00:00Z'),
      at('2026-01-09T00:00:00Z'),
    );
    expect(shifts).toHaveLength(1);
    expect(shifts[0]!.userId).toBe('ana');
  });

  it('puts an override on top and splits the shift around it', () => {
    const overrides: OverrideWindow[] = [
      { userId: 'bo', startsAt: at('2026-01-07T09:00:00Z'), endsAt: at('2026-01-08T09:00:00Z') },
    ];
    const shifts = shiftsBetween(
      rotation,
      overrides,
      at('2026-01-05T09:00:00Z'),
      at('2026-01-12T09:00:00Z'),
    );
    expect(shifts.map((s) => [s.userId, s.override])).toEqual([
      ['ana', false],
      ['bo', true],
      ['ana', false],
    ]);
    expect(onCallAt(rotation, overrides, at('2026-01-07T12:00:00Z'))!.userId).toBe('bo');
    expect(onCallAt(rotation, overrides, at('2026-01-08T09:00:00Z'))!.userId).toBe('ana');
  });

  it('joins an override that crosses a handoff into one block', () => {
    const overrides: OverrideWindow[] = [
      { userId: 'cy', startsAt: at('2026-01-11T09:00:00Z'), endsAt: at('2026-01-13T09:00:00Z') },
    ];
    const shifts = shiftsBetween(
      rotation,
      overrides,
      at('2026-01-05T09:00:00Z'),
      at('2026-01-19T09:00:00Z'),
    );
    const blocks = shifts.filter((s) => s.override);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.startsAt.toISOString()).toBe('2026-01-11T09:00:00.000Z');
    expect(blocks[0]!.endsAt.toISOString()).toBe('2026-01-13T09:00:00.000Z');
  });

  it('handles daily rotations and an empty team', () => {
    const daily: Rotation = { ...rotation, rotationHours: 24, participants: ['ana', 'bo'] };
    expect(onCallAt(daily, [], at('2026-01-06T10:00:00Z'))!.userId).toBe('bo');
    expect(
      shiftsBetween(
        { ...rotation, participants: [] },
        [],
        at('2026-01-05T00:00:00Z'),
        at('2026-02-01T00:00:00Z'),
      ),
    ).toEqual([]);
    expect(onCallAt({ ...rotation, participants: [] }, [], at('2026-01-05T00:00:00Z'))).toBeNull();
  });
});
