import { Lock, Menu, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/layout/logo';
import { SidebarNav } from '@/components/layout/sidebar';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { Button } from '@/components/ui/button';
import { AnimatedDialog, SheetContent } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { openCommandPalette } from '@/features/palette/open-palette';
import { useVault } from '@/features/vault/vault-context';

export function TopBar() {
  const { locked, lock } = useVault();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas/85 px-3 backdrop-blur-md sm:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <Link to="/dashboard" className="lg:hidden" aria-label="Vaultory dashboard">
        <Logo size="sm" showWordmark={false} />
      </Link>

      <button
        type="button"
        onClick={openCommandPalette}
        className="group hidden h-8 flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 text-[13px] text-fg-subtle transition-colors hover:border-line-strong sm:flex sm:max-w-sm"
        aria-label="Open command palette"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search or run a command…</span>
        <kbd className="rounded border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Phones have no Ctrl+K - give the palette a touch entry point. */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="sm:hidden"
          onClick={openCommandPalette}
          aria-label="Search or run a command"
        >
          <Search />
        </Button>

        {!locked ? (
          <Tooltip content="Lock vault">
            <Button variant="ghost" size="icon-sm" onClick={() => lock('manual')} aria-label="Lock vault">
              <Lock />
            </Button>
          </Tooltip>
        ) : null}

        <Button asChild size="sm" className="hidden h-7 px-2 text-xs sm:inline-flex [&_svg]:size-3.5">
          <Link to="/vault/new">
            <Plus />
            New secret
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon-sm" className="sm:hidden" aria-label="New secret">
          <Link to="/vault/new">
            <Plus />
          </Link>
        </Button>

        <ThemeToggle />
        <UserMenu />
      </div>

      <AnimatedDialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent title="Navigation">
          <div className="flex flex-col gap-4">
            <Logo size="sm" />
            <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </SheetContent>
      </AnimatedDialog>
    </header>
  );
}
