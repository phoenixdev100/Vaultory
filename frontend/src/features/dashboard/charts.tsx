import { useReducedMotion } from 'framer-motion';
import { scoreColor } from '@/features/dashboard/chart-utils';

/**
 * Hand-rolled SVG chart primitives. No chart library: the dashboard needs a
 * ring, a donut and a stacked bar - ~100 lines of SVG beats a ~100KB dep.
 * Colors use the app's CSS variables so both themes resolve automatically.
 */

/** Animated circular progress ring. `score` is 0-100. */
export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const reduceMotion = useReducedMotion();
  const stroke = size / 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * (Math.min(100, Math.max(0, score)) / 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Vault security score ${score} out of 100`}
      className="-rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={scoreColor(score)}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        style={reduceMotion ? undefined : { transition: 'stroke-dasharray 700ms ease-out, stroke 300ms' }}
      />
    </svg>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Donut chart; slices render in order around the circle. */
export function DonutChart({ slices, size = 120, thickness = 16 }: { slices: DonutSlice[]; size?: number; thickness?: number }) {
  const reduceMotion = useReducedMotion();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const fractions = slices
    .filter((s) => s.value > 0)
    .map((slice) => ({ slice, fraction: total === 0 ? 0 : slice.value / total }));
  // Cumulative start offsets for each segment around the circle.
  const offsets = fractions.map((_, index) =>
    fractions.slice(0, index).reduce((sum, item) => sum + item.fraction, 0),
  );
  const segments = fractions.map(({ slice, fraction }, index) => ({
    ...slice,
    dasharray: `${Math.max(0, fraction * circumference - 1.5)} ${circumference}`,
    offset: -(offsets[index] ?? 0) * circumference,
  }));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={slices.map((s) => `${s.label}: ${s.value}`).join(', ')}
      className="-rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-surface-muted)"
        strokeWidth={thickness}
      />
      {segments.map((segment) => (
        <circle
          key={segment.label}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={segment.color}
          strokeWidth={thickness}
          strokeDasharray={segment.dasharray}
          strokeDashoffset={segment.offset}
          style={reduceMotion ? undefined : { transition: 'stroke-dasharray 500ms ease-out, stroke-dashoffset 500ms ease-out' }}
        >
          <title>{`${segment.label}: ${segment.value}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export interface BarSegment {
  label: string;
  value: number;
  color: string;
}

/** Stacked horizontal bar (e.g. strong / fair / weak distribution). */
export function SegmentBar({ segments }: { segments: BarSegment[] }) {
  const reduceMotion = useReducedMotion();
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
      role="img"
      aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
    >
      {segments
        .filter((s) => s.value > 0)
        .map((segment) => (
          <div
            key={segment.label}
            className="h-full"
            style={{
              width: `${total === 0 ? 0 : (segment.value / total) * 100}%`,
              background: segment.color,
              ...(reduceMotion ? {} : { transition: 'width 500ms ease-out' }),
            }}
          >
            <span className="sr-only">{`${segment.label}: ${segment.value}`}</span>
          </div>
        ))}
    </div>
  );
}


