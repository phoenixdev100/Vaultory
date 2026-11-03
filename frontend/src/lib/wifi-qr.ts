/**
 * Wi-Fi QR payload (ZXing format): scanning it on Android/iOS joins the
 * network without typing the password. Built locally - never sent anywhere.
 * WIFI:T:<auth>;S:<ssid>;P:<password>;H:<hidden>;;
 */

const QR_ESCAPE = /([\\;,:"'])/g;

function escape(value: string): string {
  return value.replace(QR_ESCAPE, '\\$1');
}

export interface WifiQrInput {
  ssid: string;
  password: string;
  /** WPA/WPA2/WEP/nopass - defaults to WPA. */
  auth?: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}

export function buildWifiQrString({ ssid, password, auth = 'WPA', hidden = false }: WifiQrInput): string {
  const parts = [`T:${auth}`, `S:${escape(ssid)}`];
  if (auth !== 'nopass' && password) parts.push(`P:${escape(password)}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}
