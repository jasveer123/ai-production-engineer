export interface CalendarInterval {
  person: { userId: string; name: string | null; email: string };
  startsAt: string;
  endsAt: string;
  source: 'layer' | 'override';
}

const stamp = (iso: string | Date) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function toICalendar(
  schedule: { id: string; name: string },
  intervals: CalendarInterval[],
  now: Date,
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pramaan//On-call//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(`On call: ${schedule.name}`)}`,
  ];
  for (const i of intervals) {
    const who = i.person.name ?? i.person.email;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${schedule.id}-${stamp(i.startsAt)}-${i.person.userId}@pramaan`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(i.startsAt)}`,
      `DTEND:${stamp(i.endsAt)}`,
      `SUMMARY:${escapeText(`${who} on call${i.source === 'override' ? ' (override)' : ''}`)}`,
      `DESCRIPTION:${escapeText(`${schedule.name}: ${who} <${i.person.email}>`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
