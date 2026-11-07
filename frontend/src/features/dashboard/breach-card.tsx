import { AlertTriangle, ArrowRight, Radar, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { checkPasswordBreached } from '@/lib/breach';
import { daysSince, formatRelative } from '@/lib/format';
import type { AuditReport } from '@/lib/audit';

interface BreachSummary {
  at: string;
  checked: number;
  found: number;
}

const storageKey = (userId: string) => `vaultory.breach.${userId}`;

function readSummary(userId: string): BreachSummary | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BreachSummary;
    return typeof parsed.at === 'string' && typeof parsed.found === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Dashboard-level breach status. Running the check hits the HIBP range API per
 * unique password value (k-anonymity - only 5 hash chars leave the browser)
 * and persists a coarse summary locally so the card stays informative between
 * visits. Passwords themselves are never sent or stored.
 * Mount with `key={userId}` so a different account gets fresh state.
 */
export function BreachCard({ report, userId }: { report: AuditReport | null; userId: string }) {
  const [summary, setSummary] = useState<BreachSummary | null>(() => readSummary(userId));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liveFound, setLiveFound] = useState<number | null>(null);

  async function runCheck() {
    if (!report) return;
    // Deduplicate values: the same reused password only hits the API once.
    const unique = [...new Set(report.findings.map((f) => f.value))];
    setRunning(true);
    setProgress(0);
    let found = 0;
    try {
      for (let i = 0; i < unique.length; i++) {
        const value = unique[i]!;
        const result = await checkPasswordBreached(value);
        if (result.status === 'found') found += 1;
        setProgress(i + 1);
      }
      const next = { at: new Date().toISOString(), checked: unique.length, found };
      setSummary(next);
      setLiveFound(found);
      try {
        localStorage.setItem(storageKey(userId), JSON.stringify(next));
      } catch {
        /* storage unavailable - the live result still shows */
      }
    } finally {
      setRunning(false);
    }
  }

  const displayFound = liveFound ?? summary?.found ?? null;
  const stale = summary ? daysSince(summary.at) > 30 : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Breach watch</CardTitle>
        <CardDescription>HaveIBeenPwned k-anonymity check</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!report || report.total === 0 ? (
          <p className="text-[13px] text-fg-subtle">No passwords to check yet.</p>
        ) : (
          <>
            {running ? (
              <div className="flex flex-col gap-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${(progress / Math.max(1, new Set(report.findings.map((f) => f.value)).size)) * 100}%` }}
                  />
                </div>
                <p className="text-[12px] text-fg-subtle">Checking {progress}…</p>
              </div>
            ) : displayFound === null ? (
              <p className="text-[13px] leading-5 text-fg-subtle">
                {report.total} passwords have never been checked against public breach corpora.
              </p>
            ) : displayFound > 0 ? (
              <div className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-danger/40 bg-danger-soft px-3 py-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                <p className="text-[13px] leading-5 text-danger">
                  <strong>{displayFound}</strong> password{displayFound === 1 ? '' : 's'} found in known
                  breaches - rotate them from the audit page.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-[var(--radius-control)] border border-success/40 bg-success-soft px-3 py-2.5">
                <ShieldCheck className="size-4 shrink-0 text-success" />
                <p className="text-[13px] text-fg">
                  <strong>{summary?.checked ?? 0}</strong> checked - none appear in known breaches.
                </p>
              </div>
            )}

            {summary && !running ? (
              <p className="text-[11px] text-fg-subtle">
                Last run {formatRelative(summary.at)}
                {stale ? ' - over 30 days ago, worth re-running' : ''}.
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void runCheck()}
                loading={running}
              >
                <Radar />
                {summary ? 'Re-check all' : 'Check all'}
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/audit">
                  Details
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
