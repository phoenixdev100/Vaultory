import { Activity as ActivityIcon, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/skeleton';
import { ACTIVITY_LABELS, SECURITY_EVENTS } from '@/features/history/activity-labels';
import { useActivity } from '@/features/history/queries';
import { ApiError } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';

/**
 * The activity log records *that* something happened, never what was in it.
 * Secret values are never part of an event.
 */
export default function ActivityPage() {
  const activity = useActivity(100);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Activity"
        description="A security-conscious history of what happened in your vault - never what the values were."
      />

      {activity.isLoading ? (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <SkeletonRows rows={8} />
        </div>
      ) : activity.isError ? (
        <EmptyState
          icon={ActivityIcon}
          title="Could not load activity"
          description={activity.error instanceof ApiError ? activity.error.message : undefined}
          action={
            <Button size="sm" variant="secondary" onClick={() => void activity.refetch()}>
              Retry
            </Button>
          }
        />
      ) : activity.data && activity.data.items.length > 0 ? (
        <ol className="relative flex flex-col gap-0 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-line">
          {activity.data.items.map((event) => {
            const security = SECURITY_EVENTS.has(event.type);
            return (
              <li key={event.id} className="relative flex gap-4 py-2.5 pl-7">
                <span
                  className={
                    security
                      ? 'absolute top-4 left-0 size-[15px] rounded-full border-2 border-primary bg-canvas'
                      : 'absolute top-4 left-0 size-[15px] rounded-full border-2 border-line-strong bg-canvas'
                  }
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-fg">{ACTIVITY_LABELS[event.type] ?? event.type}</p>
                    {security ? (
                      <Badge variant="primary" size="sm">
                        <ShieldCheck />
                        Security
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                    {event.targetLabel ? <span className="text-fg-muted">{event.targetLabel}</span> : null}
                    <span title={formatDateTime(event.createdAt)}>{formatRelative(event.createdAt)}</span>
                    {event.ipLabel ? (
                      <span className="inline-flex items-center gap-1">
                        <MonitorSmartphone className="size-3" />
                        {event.ipLabel}
                      </span>
                    ) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState
          icon={ActivityIcon}
          title="No activity yet"
          description="Sign-ins, edits, deletions and security changes will appear here as they happen."
        />
      )}
    </div>
  );
}
