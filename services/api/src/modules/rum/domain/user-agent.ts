export interface Agent {
  browser: string | null;
  os: string | null;
  device: string;
}

export function parseAgent(ua: string | undefined): Agent {
  const s = ua ?? '';
  const browser = /Edg\/([\d.]+)/.exec(s)
    ? 'Edge'
    : /OPR\/([\d.]+)/.exec(s)
      ? 'Opera'
      : /Firefox\/([\d.]+)/.exec(s)
        ? 'Firefox'
        : /Chrome\/([\d.]+)/.exec(s)
          ? 'Chrome'
          : /Version\/([\d.]+).*Safari/.exec(s)
            ? 'Safari'
            : null;
  const os = /Windows/.test(s)
    ? 'Windows'
    : /Android/.test(s)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(s)
        ? 'iOS'
        : /Mac OS X/.test(s)
          ? 'macOS'
          : /Linux/.test(s)
            ? 'Linux'
            : null;
  const device = /iPad|Tablet/.test(s)
    ? 'tablet'
    : /Mobi|iPhone|Android/.test(s)
      ? 'mobile'
      : 'desktop';
  return { browser, os, device };
}
