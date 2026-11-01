import { Laptop, Monitor, Smartphone, Tablet, Tv, type LucideIcon } from 'lucide-react';

export interface DeviceInfo {
  /** e.g. "Windows" | "macOS" | "Android" | "iPhone" | "Linux" */
  os: string;
  /** e.g. "Edge" | "Chrome" | "Firefox" | "Safari" */
  browser: string;
  /** Combined short label, e.g. "Windows · Edge". */
  label: string;
  icon: LucideIcon;
  /** "desktop" | "phone" | "tablet" | "tv" */
  kind: 'desktop' | 'phone' | 'tablet' | 'tv';
}

/**
 * Turns a raw User-Agent string into a friendly device description.
 * Deliberately small - covers the mainstream browsers/OSes and falls back to
 * "Unknown device" pieces rather than shipping a full UA parser dependency.
 */
export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  const agent = ua ?? '';
  const a = agent.toLowerCase();

  let os = 'Unknown OS';
  let kind: DeviceInfo['kind'] = 'desktop';
  if (/iphone|ipod/.test(a)) {
    os = 'iPhone';
    kind = 'phone';
  } else if (/ipad/.test(a)) {
    os = 'iPad';
    kind = 'tablet';
  } else if (/android/.test(a)) {
    const match = agent.match(/Android ([\d.]+)/i);
    os = `Android${match ? ` ${match[1]}` : ''}`;
    kind = /mobile/.test(a) ? 'phone' : 'tablet';
  } else if (/windows phone/.test(a)) {
    os = 'Windows Phone';
    kind = 'phone';
  } else if (/windows nt/.test(a)) {
    os = 'Windows';
  } else if (/mac os x|macintosh/.test(a)) {
    os = 'macOS';
  } else if (/cros/.test(a)) {
    os = 'ChromeOS';
  } else if (/linux/.test(a)) {
    os = 'Linux';
  }

  if (/smart-tv|smarttv|appletv|chromecast|roku|tv\//.test(a)) kind = 'tv';

  let browser = 'Unknown browser';
  if (/edg\//.test(a) || /edge\//.test(a)) browser = 'Edge';
  else if (/opr\/|opera/.test(a)) browser = 'Opera';
  else if (/vivaldi/.test(a)) browser = 'Vivaldi';
  else if (/brave/.test(a)) browser = 'Brave';
  else if (/samsungbrowser/.test(a)) browser = 'Samsung Internet';
  else if (/firefox|fxios/.test(a)) browser = 'Firefox';
  else if (/crios|chrome\//.test(a)) browser = 'Chrome';
  else if (/safari/.test(a)) browser = 'Safari';

  const icons: Record<DeviceInfo['kind'], LucideIcon> = {
    desktop: Laptop,
    phone: Smartphone,
    tablet: Tablet,
    tv: Tv,
  };

  const known = os !== 'Unknown OS' || browser !== 'Unknown browser';
  return {
    os,
    browser,
    label: known ? `${os} · ${browser}` : 'Unknown device',
    icon: kind === 'desktop' ? Monitor : icons[kind],
    kind,
  };
}
