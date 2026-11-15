import { coverage, type Layer } from './domain/layers';
import { dayNumber, zonedToUtc } from './domain/zoned-time';

const at = (iso: string) => new Date(iso);
const daily = (handoffTime: string, startDate = '2026-01-01'): Layer => ({
  id: 'l1',
  name: 'Primary',
  rotation: { kind: 'calendar', lengthDays: 1, startDate, handoffTime },
  participants: ['ana', 'bo'],
  restrictions: [],
});
const handoffs = (tz: string, layer: Layer, from: string, to: string) =>
  coverage({ timezone: tz, layers: [layer] }, [], at(from), at(to)).segments.map((s) =>
    s.startsAt.toISOString(),
  );

describe('local wall-clock conversion', () => {
  it('moves a skipped spring-forward time forward and picks the first repeated fall-back time', () => {
    expect(zonedToUtc(dayNumber('2026-03-29'), 150, 'Europe/Berlin').toISOString()).toBe(
      '2026-03-29T01:30:00.000Z',
    );
    expect(zonedToUtc(dayNumber('2026-10-25'), 150, 'Europe/Berlin').toISOString()).toBe(
      '2026-10-25T00:30:00.000Z',
    );
    expect(zonedToUtc(dayNumber('2026-03-08'), 150, 'America/New_York').toISOString()).toBe(
      '2026-03-08T07:30:00.000Z',
    );
    expect(zonedToUtc(dayNumber('2026-11-01'), 90, 'America/New_York').toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });
});

describe('calendar rotations across DST', () => {
  it('keeps a 09:00 Berlin handoff on the wall clock through spring-forward and fall-back', () => {
    expect(
      handoffs('Europe/Berlin', daily('09:00'), '2026-03-28T08:00:00Z', '2026-03-30T07:00:00Z'),
    ).toEqual(['2026-03-28T08:00:00.000Z', '2026-03-29T07:00:00.000Z']);
    expect(
      handoffs('Europe/Berlin', daily('09:00'), '2026-10-24T07:00:00Z', '2026-10-26T08:00:00Z'),
    ).toEqual(['2026-10-24T07:00:00.000Z', '2026-10-25T08:00:00.000Z']);
  });

  it('keeps a 09:00 New York handoff on the wall clock', () => {
    expect(
      handoffs('America/New_York', daily('09:00'), '2026-03-07T14:00:00Z', '2026-03-09T13:00:00Z'),
    ).toEqual(['2026-03-07T14:00:00.000Z', '2026-03-08T13:00:00.000Z']);
    expect(
      handoffs('America/New_York', daily('09:00'), '2026-10-31T13:00:00Z', '2026-11-02T14:00:00Z'),
    ).toEqual(['2026-10-31T13:00:00.000Z', '2026-11-01T14:00:00.000Z']);
  });

  it('hands off at 02:30 on the Berlin spring-forward day one hour late and never twice', () => {
    expect(
      handoffs('Europe/Berlin', daily('02:30'), '2026-03-28T01:30:00Z', '2026-03-30T00:30:00Z'),
    ).toEqual(['2026-03-28T01:30:00.000Z', '2026-03-29T01:30:00.000Z']);
  });

  it('rotates weekly in a zone without DST at exactly seven days', () => {
    const weekly: Layer = {
      ...daily('10:00', '2026-11-02'),
      rotation: { kind: 'calendar', lengthDays: 7, startDate: '2026-11-02', handoffTime: '10:00' },
    };
    const result = coverage(
      { timezone: 'Asia/Kolkata', layers: [weekly] },
      [],
      at('2026-11-02T04:30:00Z'),
      at('2026-11-16T04:30:00Z'),
    );
    expect(result.segments.map((s) => [s.userId, s.startsAt.toISOString()])).toEqual([
      ['ana', '2026-11-02T04:30:00.000Z'],
      ['bo', '2026-11-09T04:30:00.000Z'],
    ]);
    expect(result.gaps).toEqual([]);
  });
});

describe('layers, restrictions and overrides', () => {
  const office: Layer = {
    id: 'office',
    name: 'Office hours',
    rotation: { kind: 'calendar', lengthDays: 7, startDate: '2026-11-02', handoffTime: '09:00' },
    participants: ['ana'],
    restrictions: [{ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }],
  };
  const nights: Layer = {
    id: 'nights',
    name: 'Nights',
    rotation: { kind: 'calendar', lengthDays: 1, startDate: '2026-11-02', handoffTime: '17:00' },
    participants: ['bo'],
    restrictions: [{ days: [1, 2, 3, 4], start: '17:00', end: '09:00' }],
  };

  it('lets earlier layers win and reports uncovered time as gaps', () => {
    const result = coverage(
      { timezone: 'Europe/Berlin', layers: [office, nights] },
      [],
      at('2026-11-06T00:00:00Z'),
      at('2026-11-07T00:00:00Z'),
    );
    expect(
      result.segments.map((s) => [s.userId, s.startsAt.toISOString(), s.endsAt.toISOString()]),
    ).toEqual([
      ['bo', '2026-11-06T00:00:00.000Z', '2026-11-06T08:00:00.000Z'],
      ['ana', '2026-11-06T08:00:00.000Z', '2026-11-06T16:00:00.000Z'],
    ]);
    expect(result.gaps.map((g) => g.startsAt.toISOString())).toEqual(['2026-11-06T16:00:00.000Z']);
  });

  it('puts an override above every layer', () => {
    const result = coverage(
      { timezone: 'Europe/Berlin', layers: [office] },
      [
        {
          id: 'o1',
          userId: 'cy',
          startsAt: at('2026-11-04T10:00:00Z'),
          endsAt: at('2026-11-04T11:00:00Z'),
        },
      ],
      at('2026-11-04T08:00:00Z'),
      at('2026-11-04T16:00:00Z'),
    );
    expect(result.segments.map((s) => [s.userId, s.source])).toEqual([
      ['ana', 'layer'],
      ['cy', 'override'],
      ['ana', 'layer'],
    ]);
  });
});
