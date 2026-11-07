import { AlertTriangle, ArrowRight, Copy, Clock, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoreRing, SegmentBar } from '@/features/dashboard/charts';
import { estimateStrength } from '@/lib/crypto/generator';
import type { AuditReport } from '@/lib/audit';

const STRENGTH_COLORS = {
  weak: 'var(--color-danger)',
  fair: 'var(--color-warning)',
  strong: 'var(--color-success)',
} as const;

/**
 * Big animated score ring + password-strength distribution + issue chips.
 * Local findings come from the decrypted vault; `breachedValues` feeds the
 * live HaveIBeenPwned results so the score drops as leaks land.
 */
export function VaultHealthCard({
  report,
  breachedValues = new Set<string>(),
}: {
  report: AuditReport | null;
  breachedValues?: Set<string>;
}) {
  if (!report || report.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">Vault health</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <ScoreRing score={100} size={88} />
          <p className="text-[13px] leading-5 text-fg-subtle">
            No passwords stored yet. Add a login and the strength breakdown appears here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const buckets = { weak: 0, fair: 0, strong: 0 };
  for (const finding of report.findings) {
    const score = estimateStrength(finding.value).score;
    if (score <= 1) buckets.weak += 1;
    else if (score === 2) buckets.fair += 1;
    else buckets.strong += 1;
  }

  const isClean = (f: (typeof report.findings)[number]) =>
    !f.weak && f.reuseCount === 1 && !f.stale && !breachedValues.has(f.value);
  const cleanCount = report.findings.filter(isClean).length;
  const score = Math.round((cleanCount / report.total) * 100);
  const breachedCount = report.findings.filter((f) => breachedValues.has(f.value)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Vault health</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/audit">
            Audit
            <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <ScoreRing score={score} size={88} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-semibold text-fg tabular-nums">
              {score}
              <span className="text-sm font-medium text-fg-subtle"> / 100</span>
            </p>
            <p className="text-xs text-fg-subtle">
              {cleanCount} of {report.total} passwords clean
            </p>
          </div>
        </div>

        <SegmentBar
          segments={[
            { label: 'Strong', value: buckets.strong, color: STRENGTH_COLORS.strong },
            { label: 'Fair', value: buckets.fair, color: STRENGTH_COLORS.fair },
            { label: 'Weak', value: buckets.weak, color: STRENGTH_COLORS.weak },
          ]}
        />
        <div className="flex items-center justify-between text-[11px] text-fg-subtle">
          <span>Strong {buckets.strong}</span>
          <span>Fair {buckets.fair}</span>
          <span>Weak {buckets.weak}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant={report.weak.length ? 'danger' : 'success'} size="sm">
            <ShieldAlert />
            {report.weak.length} weak
          </Badge>
          <Badge variant={report.reused.length ? 'warning' : 'success'} size="sm">
            <Copy />
            {report.reused.length} reused
          </Badge>
          <Badge variant={report.stale.length ? 'warning' : 'success'} size="sm">
            <Clock />
            {report.stale.length} stale
          </Badge>
          <Badge variant={breachedCount ? 'danger' : 'success'} size="sm">
            <AlertTriangle />
            {breachedCount} breached
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
