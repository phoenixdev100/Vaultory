import { useState, type ReactNode } from 'react';
import { faviconUrl } from '@/lib/api';
import { hostnameOf } from '@/lib/hostname';
import { cn } from '@/lib/utils';

/**
 * Site icon for a secret's URL, served through our own favicon proxy (the
 * browser never talks to the third-party site or a public favicon service).
 * Falls back to the category icon when no icon exists.
 */
export function Favicon({
  url,
  fallback,
  className,
}: {
  url: string | undefined;
  fallback: ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const host = hostnameOf(url);

  if (!host || failed) return <>{fallback}</>;

  return (
    <img
      src={faviconUrl(host)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('size-4 rounded-[3px] object-contain', className)}
    />
  );
}
