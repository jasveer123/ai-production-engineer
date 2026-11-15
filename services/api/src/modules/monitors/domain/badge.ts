const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const COLORS = { up: '#2f9e44', down: '#e03131', paused: '#868e96', pending: '#868e96' } as const;

export type BadgeState = keyof typeof COLORS;

const width = (text: string) => Math.round(text.length * 6.5 + 12);

export function renderBadge(label: string, state: BadgeState): string {
  const left = escape(label.slice(0, 40));
  const right = state;
  const lw = width(label.slice(0, 40));
  const rw = width(right);
  const total = lw + rw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${left}: ${right}"><title>${left}: ${right}</title><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${rw}" height="20" fill="${COLORS[state]}"/><g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11"><text x="${lw / 2}" y="14">${left}</text><text x="${lw + rw / 2}" y="14">${right}</text></g></svg>`;
}
