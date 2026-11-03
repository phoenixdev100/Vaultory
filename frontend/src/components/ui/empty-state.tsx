import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Compact variant for use inside cards and panels. */
  dense?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, className, dense = false }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        dense ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full border border-line bg-surface-muted text-fg-subtle',
          dense ? 'size-9' : 'size-12',
        )}
      >
        <Icon className={dense ? 'size-4' : 'size-5'} />
      </div>
      <div className="flex flex-col gap-1">
        <p className={cn('font-semibold text-fg', dense ? 'text-[13px]' : 'text-sm')}>{title}</p>
        {description ? (
          <p className="max-w-sm text-[13px] leading-5 text-fg-muted text-balance">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}
