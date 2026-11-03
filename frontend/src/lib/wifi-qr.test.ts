import { describe, expect, it } from 'vitest';
import { buildWifiQrString } from '@/lib/wifi-qr';

describe('buildWifiQrString', () => {
  it('builds the ZXing WIFI payload', () => {
    expect(buildWifiQrString({ ssid: 'Home Wi-Fi', password: 's3cret!' })).toBe(
      'WIFI:T:WPA;S:Home Wi-Fi;P:s3cret!;;',
    );
  });

  it('escapes special characters in ssid and password', () => {
    const value = buildWifiQrString({ ssid: 'my;net', password: 'p"a,s:s' });
    expect(value).toBe('WIFI:T:WPA;S:my\\;net;P:p\\"a\\,s\\:s;;');
  });

  it('omits the password for open networks and marks hidden SSIDs', () => {
    expect(buildWifiQrString({ ssid: 'cafe', password: '', auth: 'nopass' })).toBe('WIFI:T:nopass;S:cafe;;');
    expect(buildWifiQrString({ ssid: 'ghost', password: 'x', hidden: true })).toBe(
      'WIFI:T:WPA;S:ghost;P:x;H:true;;',
    );
  });
});
