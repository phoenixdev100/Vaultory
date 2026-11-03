import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
  /** Optional leading icon/image rendered before the title. */
  titleIcon?: ReactNode;
}

export function PageHeader({ title, description, actions, breadcrumbs, className, titleIcon }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {breadcrumbs?.length ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-fg-subtle">
            {breadcrumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3" aria-hidden /> : null}
                {crumb.to ? (
                  <Link to={crumb.to} className="rounded transition-colors hover:text-fg">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-fg-muted">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-[-0.01em] text-fg">
            {titleIcon}
            <span className="min-w-0 truncate">{title}</span>
          </h1>
          {description ? <p className="text-[13px] leading-5 text-fg-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
