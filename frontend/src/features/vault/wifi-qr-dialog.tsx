import { QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { buildWifiQrString } from '@/lib/wifi-qr';

/**
 * Renders a scannable Wi-Fi join QR for WIFI_VPN secrets. The data URL is
 * generated locally from the decrypted fields; nothing leaves the browser.
 */
export function WifiQrDialog({
  ssid,
  password,
  open,
  onOpenChange,
}: {
  ssid: string;
  password: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void toDataURL(buildWifiQrString({ ssid, password }), {
      width: 280,
      margin: 1,
      color: { dark: '#111116', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [open, ssid, password]);

  return (
    <AnimatedDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Join this Wi-Fi" description="Scan with a phone camera to connect - no typing needed.">
        <div className="flex flex-col items-center gap-3 py-2">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`QR code to join ${ssid}`}
              className="aspect-square w-full max-w-[280px] rounded-[var(--radius-card)] border border-line bg-white p-3"
            />
          ) : (
            <div className="aspect-square w-full max-w-[280px] animate-pulse rounded-[var(--radius-card)] bg-surface-muted" />
          )}
          <p className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
            <QrCode className="size-3.5" />
            {ssid} - shown only on this device
          </p>
        </div>
      </DialogContent>
    </AnimatedDialog>
  );
}
