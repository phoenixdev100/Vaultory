import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-4 text-center">
      <Logo size="md" />
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-xs tracking-widest text-fg-subtle uppercase">Error 404</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">This page does not exist</h1>
        <p className="max-w-sm text-[13px] leading-5 text-fg-muted">
          The link may be outdated. Your vault and its contents are unaffected.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="secondary">
          <Link to="/">
            <ArrowLeft />
            Home
          </Link>
        </Button>
        <Button asChild>
          <Link to="/dashboard">Open my vault</Link>
        </Button>
      </div>
    </div>
  );
}
