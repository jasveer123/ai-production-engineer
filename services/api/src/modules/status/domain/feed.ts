export interface FeedEntry {
  id: string;
  title: string;
  body: string;
  updatedAt: Date;
}

export interface FeedInput {
  title: string;
  link: string;
  entries: FeedEntry[];
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function renderAtom(feed: FeedInput, now: Date): string {
  const updated = (feed.entries[0]?.updatedAt ?? now).toISOString();
  const entries = feed.entries.map(
    (e) =>
      `<entry><id>urn:uuid:${e.id}</id><title>${escapeXml(e.title)}</title><updated>${e.updatedAt.toISOString()}</updated><link href="${escapeXml(feed.link)}"/><content type="text">${escapeXml(e.body)}</content></entry>`,
  );
  return `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>${escapeXml(feed.link)}</id><title>${escapeXml(feed.title)}</title><updated>${updated}</updated><link href="${escapeXml(feed.link)}"/>${entries.join('')}</feed>`;
}

export function renderRss(feed: FeedInput): string {
  const items = feed.entries.map(
    (e) =>
      `<item><guid isPermaLink="false">${e.id}</guid><title>${escapeXml(e.title)}</title><pubDate>${e.updatedAt.toUTCString()}</pubDate><link>${escapeXml(feed.link)}</link><description>${escapeXml(e.body)}</description></item>`,
  );
  return `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>${escapeXml(feed.title)}</title><link>${escapeXml(feed.link)}</link><description>${escapeXml(feed.title)}</description>${items.join('')}</channel></rss>`;
}
