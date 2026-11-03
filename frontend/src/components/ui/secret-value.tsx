import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Fixed-width mask: the real length of a secret is itself information. */
const MASK = '••••••••••••';

interface SecretValueProps {
  value: string;
  label?: string;
  /** Sensitive values start hidden; metadata like a URL can start visible. */
  masked?: boolean;
  multiline?: boolean;
  monospace?: boolean;
  className?: string;
  /** Re-hide after this many seconds while revealed. 0 keeps it visible. */
  autoHideSeconds?: number;
}

export function SecretValue({
  value,
  label = 'Value',
  masked = true,
  multiline = false,
  monospace = true,
  className,
  autoHideSeconds = 30,
}: SecretValueProps) {
  const [revealed, setRevealed] = useState(!masked);

  useEffect(() => {
    if (!revealed || !masked || autoHideSeconds <= 0) return;
    const timer = window.setTimeout(() => setRevealed(false), autoHideSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [revealed, masked, autoHideSeconds]);

  const empty = value === '';

  return (
    <div
      className={cn(
        'group flex min-w-0 items-start gap-1 rounded-[var(--radius-control)] border border-line bg-surface-muted/60 py-1.5 pr-1 pl-2.5',
        className,
      )}
    >
      <div
        className={cn(
          'min-w-0 flex-1 py-1 text-[13px] break-words text-fg',
          monospace && 'font-mono',
          multiline && revealed && 'whitespace-pre-wrap',
          !multiline && !(masked && revealed) && 'truncate',
          !multiline && masked && revealed && 'break-all',
          empty && 'text-fg-subtle italic',
        )}
      >
        {empty ? 'Not set' : revealed ? value : MASK}
      </div>

      {!empty ? (
        <div className="flex shrink-0 items-center gap-0.5">
          {masked ? (
            <Tooltip content={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setRevealed((previous) => !previous)}
                aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                aria-pressed={revealed}
              >
                {revealed ? <EyeOff /> : <Eye />}
              </Button>
            </Tooltip>
          ) : null}
          <CopyButton value={value} label={label} />
        </div>
      ) : null}
    </div>
  );
}
