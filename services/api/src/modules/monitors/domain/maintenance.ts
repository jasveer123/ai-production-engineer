import type { MaintenanceWindow } from '@ape/api-contracts';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

function localTime(now: Date, timeZone: string): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    day: WEEKDAYS.indexOf(get('weekday')),
    minute: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function inMaintenance(window: MaintenanceWindow | null | undefined, now: Date): boolean {
  if (!window) return false;
  const { day, minute } = localTime(now, window.timezone);
  const from = minutes(window.from);
  const to = minutes(window.to);
  if (from < to) return window.weekdays.includes(day) && minute >= from && minute < to;
  // An overnight window belongs to the weekday on which it starts.
  if (minute >= from) return window.weekdays.includes(day);
  if (minute < to) return window.weekdays.includes((day + 6) % 7);
  return false;
}
