import { cn } from '@/lib/utils';

/**
 * The Vaultory mark from public/logo.png (transparent PNG).
 * `object-contain` keeps the 1024x938 art undistorted inside square size boxes.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt=""
      aria-hidden
      draggable={false}
      className={cn('size-7 shrink-0 object-contain select-none', className)}
    />
  );
}

interface LogoProps {
  className?: string;
  markClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

const WORDMARK_SIZE = {
  sm: 'text-[15px]',
  md: 'text-[17px]',
  lg: 'text-2xl',
} as const;

const MARK_SIZE = {
  sm: 'size-6',
  md: 'size-7',
  lg: 'size-9',
} as const;

export function Logo({ className, markClassName, size = 'md', showWordmark = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={cn(MARK_SIZE[size], markClassName)} />
      {showWordmark ? (
        <span className={cn('font-semibold tracking-[-0.02em] text-fg', WORDMARK_SIZE[size])}>Vaultory</span>
      ) : null}
    </span>
  );
}
