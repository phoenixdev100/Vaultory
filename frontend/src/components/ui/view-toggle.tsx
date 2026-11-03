import { cn } from '@/lib/utils';
import { VIEW_MODE_OPTIONS, type ViewMode } from '@/lib/view-mode';

/**
 * Compact list/grid switch for list pages. The chosen mode is persisted by
 * the caller (useViewMode), so the selection sticks across reloads.
 */
export function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className="flex items-center rounded-[var(--radius-control)] border border-line bg-surface p-0.5 shadow-subtle"
    >
      {VIEW_MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-label={option.label}
          aria-pressed={mode === option.value}
          title={option.label}
          className={cn(
            'flex size-7 items-center justify-center rounded-[calc(var(--radius-control)-2px)] transition-colors',
            mode === option.value ? 'bg-primary-soft text-primary' : 'text-fg-subtle hover:text-fg',
          )}
        >
          <option.icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
