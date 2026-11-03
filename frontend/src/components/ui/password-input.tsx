import { Eye, EyeOff } from 'lucide-react';
import { type ComponentProps, forwardRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { estimateStrength } from '@/lib/crypto/generator';
import { cn } from '@/lib/utils';

/** Password input with a reveal toggle. Never autofilled by the browser. */
export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={revealed ? 'text' : 'password'}
        className={cn('pr-10 font-mono', className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-0.5 right-0.5"
        onClick={() => setRevealed((previous) => !previous)}
        aria-label={revealed ? 'Hide password' : 'Show password'}
        aria-pressed={revealed}
        tabIndex={-1}
      >
        {revealed ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
});

const SEGMENT_COLORS = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success'] as const;

/** Entropy estimate shown while choosing a password. Computed locally. */
export function PasswordStrength({ password, className }: { password: string; className?: string }) {
  const { score, label, bits } = estimateStrength(password);
  if (password === '') return null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              index <= score - 1 ? SEGMENT_COLORS[score] : 'bg-line-strong',
            )}
          />
        ))}
      </div>
      <p className="text-xs text-fg-subtle">
        <span className="font-medium text-fg-muted">{label}</span> · about {bits} bits of entropy
      </p>
    </div>
  );
}
