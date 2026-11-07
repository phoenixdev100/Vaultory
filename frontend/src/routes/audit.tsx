import { AlertTriangle, Clock, Copy, Files, KeyRound, Radar, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useSecrets } from '@/features/vault/queries';
import { categoryMeta } from '@/features/vault/categories';
import { analyzePasswords, findDuplicates, type PasswordFinding } from '@/lib/audit';
import { checkPasswordBreached, type BreachResult } from '@/lib/breach';
import { cn } from '@/lib/utils';

type BreachState = Record<string, BreachResult | 'checking'>;

function findingKey(f: PasswordFinding): string {
  return `${f.secretId}:${f.fieldKey}`;
}

function scoreTone(score: number): { text: string; ring: string } {
  if (score >= 80) return { text: 'text-success', ring: 'border-success/40' };
  if (score >= 50) return { text: 'text-warning', ring: 'border-warning/40' };
  return { text: 'text-danger', ring: 'border-danger/40' };
}

function FindingRow({
  finding,
  issue,
  breach,
  onCheck,
}: {
  finding: PasswordFinding;
  issue: string;
  breach?: BreachResult | 'checking';
  onCheck: (f: PasswordFinding) => void;
}) {
  const meta = categoryMeta(finding.category);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border ${meta.accent}`}>
        <meta.icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-fg">{finding.title}</p>
        <p className="truncate text-xs text-fg-subtle">
          {finding.fieldLabel} · {issue}
        </p>
      </div>
      {breach === 'checking' ? (
        <Badge variant="neutral" size="sm">
          Checking…
        </Badge>
      ) : breach?.status === 'found' ? (
        <Badge variant="warning" size="sm">
          Breached ×{breach.occurrences.toLocaleString()}
        </Badge>
      ) : breach?.status === 'clear' ? (
        <Badge variant="success" size="sm">
          Not breached
        </Badge>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => onCheck(finding)} title="Check this password against known breaches">
          <Radar />
          Check
        </Button>
      )}
    </li>
  );
}

export default function AuditPage() {
  // The audit analyses the same decrypted list the vault page already fetched.
  const secrets = useSecrets({ limit: 100, sort: 'title' });
  const [breachState, setBreachState] = useState<BreachState>({});
  const [checkingAll, setCheckingAll] = useState(false);

  const report = useMemo(() => analyzePasswords(secrets.data?.items ?? []), [secrets.data]);
  const duplicates = useMemo(() => findDuplicates(secrets.data?.items ?? []), [secrets.data]);
  // One automatic sweep per page visit - the button re-runs on demand.
  const autoRan = useRef(false);

  async function checkOne(finding: PasswordFinding) {
    const key = findingKey(finding);
    setBreachState((prev) => ({ ...prev, [key]: 'checking' }));
    const result = await checkPasswordBreached(finding.value);
    setBreachState((prev) => ({ ...prev, [key]: result }));
  }

  async function checkAll(force = false) {
    setCheckingAll(true);
    try {
      for (const finding of report.findings) {
        if (!force && breachState[findingKey(finding)]) continue;
        await checkOne(finding);
      }
    } finally {
      setCheckingAll(false);
    }
  }

  useEffect(() => {
    if (autoRan.current || report.total === 0) return;
    autoRan.current = true;
    void checkAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.total]);

  const isBreached = (f: PasswordFinding) => {
    const r = breachState[findingKey(f)];
    return typeof r === 'object' && r.status === 'found';
  };
  const breachedFindings = report.findings.filter(isBreached);
  const breachedCount = breachedFindings.length;
  const checkedCount = Object.values(breachState).filter((r) => r !== 'checking').length;
  // A breached password is never "clean" - the headline score must move when
  // the leak check lands, not sit at 100% while a red banner lists victims.
  const cleanCount = report.findings.filter(
    (f) => !f.weak && f.reuseCount === 1 && !f.stale && !isBreached(f),
  ).length;
  const score = report.total === 0 ? 100 : Math.round((cleanCount / report.total) * 100);
  const tone = scoreTone(score);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Password health"
        description="Weak, reused and stale passwords - analysed entirely in your browser from the decrypted vault."
        actions={
          report.total > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => void checkAll(true)} loading={checkingAll}>
              <Radar />
              {checkingAll ? `Checking ${checkedCount}/${report.total}…` : 'Re-check breaches'}
            </Button>
          ) : undefined
        }
      />

      {secrets.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : report.total === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing to audit"
          description="No password fields found in your vault yet. Add logins and this report fills in."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Card className={cn('items-center justify-center', tone.ring)}>
              <CardContent className="flex flex-col items-center gap-1 py-5">
                <span className={cn('font-display text-4xl font-semibold', tone.text)}>{score}%</span>
                <span className="text-xs font-medium text-fg-subtle">security score</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center gap-1 py-5">
                <span className="font-display text-4xl font-semibold text-fg">{report.weak.length}</span>
                <span className="flex items-center gap-1 text-xs font-medium text-fg-subtle">
                  <ShieldAlert className="size-3 text-danger" /> weak
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center gap-1 py-5">
                <span className="font-display text-4xl font-semibold text-fg">
                  {new Set(report.reused.map((f) => f.value)).size > 0 ? report.reused.length : 0}
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-fg-subtle">
                  <Copy className="size-3 text-warning" /> reused
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center gap-1 py-5">
                <span className="font-display text-4xl font-semibold text-fg">{report.stale.length}</span>
                <span className="flex items-center gap-1 text-xs font-medium text-fg-subtle">
                  <Clock className="size-3 text-fg-subtle" /> 90+ days old
                </span>
              </CardContent>
            </Card>
            <Card className={cn(breachedCount > 0 && 'border-danger/40')}>
              <CardContent className="flex flex-col items-center gap-1 py-5">
                <span
                  className={cn(
                    'font-display text-4xl font-semibold',
                    breachedCount > 0 ? 'text-danger' : 'text-fg',
                  )}
                >
                  {checkingAll && breachedCount === 0 ? '…' : breachedCount}
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-fg-subtle">
                  <AlertTriangle className="size-3 text-danger" /> in breaches
                </span>
              </CardContent>
            </Card>
          </div>

          {breachedCount > 0 ? (
            <Card className="border-danger/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[15px] text-danger">
                  <AlertTriangle className="size-4" />
                  Found in data breaches
                </CardTitle>
                <CardDescription>
                  {breachedCount} {breachedCount === 1 ? 'password appears' : 'passwords appear'} in known
                  breaches - change them as soon as possible
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="flex flex-col divide-y divide-line">
                  {breachedFindings.map((finding) => {
                    const meta = categoryMeta(finding.category);
                    const result = breachState[findingKey(finding)] as BreachResult;
                    return (
                      <li key={`breach-${findingKey(finding)}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <span className={`flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border ${meta.accent}`}>
                          <meta.icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-fg">{finding.title}</p>
                          <p className="truncate text-xs text-fg-subtle">{finding.fieldLabel}</p>
                        </div>
                        <Badge variant="danger" size="sm">
                          Seen {result.status === 'found' ? result.occurrences.toLocaleString() : 0} times
                        </Badge>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/vault/${finding.secretId}`}>Open</Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {duplicates.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[15px]">
                  <Files className="size-4 text-fg-subtle" />
                  Possible duplicates
                </CardTitle>
                <CardDescription>
                  {duplicates.length} {duplicates.length === 1 ? 'group' : 'groups'} with the same title and
                  account name - they will drift out of sync
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="flex flex-col divide-y divide-line">
                  {duplicates.map((group) => (
                    <li
                      key={`${group.title}|${group.username}`}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-fg">{group.title}</p>
                        <p className="truncate text-xs text-fg-subtle">
                          {group.username} · {group.secrets.length} copies
                        </p>
                      </div>
                      <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5">
                        {group.secrets.map((secret) => (
                          <Button key={secret.id} variant="ghost" size="sm" asChild>
                            <Link to={`/vault/${secret.id}`}>Open</Link>
                          </Button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {[
            { title: 'Weak passwords', icon: ShieldAlert, items: report.weak, issue: 'easy to guess or crack' },
            { title: 'Reused passwords', icon: Copy, items: report.reused, issue: 'same value used elsewhere' },
            { title: 'Old passwords', icon: Clock, items: report.stale, issue: 'unchanged for 90+ days' },
          ]
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <Card key={section.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[15px]">
                    <section.icon className="size-4 text-fg-subtle" />
                    {section.title}
                  </CardTitle>
                  <CardDescription>
                    {section.items.length} {section.items.length === 1 ? 'item' : 'items'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="flex flex-col divide-y divide-line">
                    {section.items.map((finding) => (
                      <FindingRow
                        key={findingKey(finding)}
                        finding={finding}
                        issue={section.issue}
                        breach={breachState[findingKey(finding)]}
                        onCheck={(f) => void checkOne(f)}
                      />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}

          <p className="flex items-start gap-2 text-xs leading-5 text-fg-subtle">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" />
            Breach checks use the HaveIBeenPwned range API: only the first 5 characters of the
            password&apos;s SHA-1 hash are sent - never the password itself.
          </p>
        </>
      )}
    </div>
  );
}
