import { motion, useReducedMotion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Logo, LogoMark } from '@/components/layout/logo';
import { PRIMARY_NAV } from '@/components/layout/nav-items';
import { WorkspaceSwitcher } from '@/features/workspace/workspace-switcher';
import { cn } from '@/lib/utils';

const COLLAPSED_WIDTH = 68;
const EXPANDED_WIDTH = 240;
const STORAGE_KEY = 'vaultory.sidebar';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function isActive(pathname: string, to: string, matchPrefix?: boolean): boolean {
  return matchPrefix ? pathname === to || pathname.startsWith(`${to}/`) : pathname === to;
}

/** Fades + clips a label so it collapses smoothly instead of snapping. */
function CollapsibleLabel({ collapsed, children }: { collapsed?: boolean; children: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.span
      initial={false}
      animate={collapsed ? { opacity: 0, width: 0 } : { opacity: 1, width: 'auto' }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
      className="relative truncate overflow-hidden whitespace-nowrap"
    >
      {children}
    </motion.span>
  );
}

export function SidebarNav({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {/* Organisation scope sits above everything else - folders and secrets
          below belong to whichever workspace is selected here. */}
      <div className={cn('mb-2', collapsed && 'mb-2 flex justify-center')}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>
      {PRIMARY_NAV.map((item) => {
        const active = isActive(pathname, item.to, item.matchPrefix);

        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              'relative flex items-center gap-2.5 rounded-[var(--radius-control)] py-2 text-[13px] font-medium transition-colors',
              collapsed ? 'justify-center gap-0 px-0' : 'px-2.5',
              active ? 'text-primary' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
            )}
          >
            {active ? (
              <motion.span
                layoutId="sidebar-active"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-[var(--radius-control)] border border-primary-line bg-primary-soft"
              />
            ) : null}
            <item.icon className="relative size-4 shrink-0" />
            <CollapsibleLabel collapsed={collapsed}>{item.label}</CollapsibleLabel>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const reduceMotion = useReducedMotion();

  function toggle() {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'collapsed' : 'expanded');
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34 }}
      className="hidden shrink-0 flex-col overflow-hidden border-r border-line bg-sidebar lg:flex"
    >
      <div className={cn('flex h-14 items-center px-4', collapsed && 'justify-center')}>
        <Link to="/dashboard" className="rounded-md" aria-label="Vaultory dashboard">
          {collapsed ? <LogoMark className="size-7" /> : <Logo size="sm" />}
        </Link>
      </div>

      <div className={cn('min-h-0 flex-1 overflow-y-auto pt-1', collapsed ? 'px-2.5' : 'px-3')}>
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className={cn('flex flex-col gap-0.5 border-t border-line', collapsed ? 'p-2.5' : 'p-3')}>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex items-center gap-2.5 rounded-[var(--radius-control)] py-2 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg',
            collapsed ? 'justify-center gap-0 px-0' : 'px-2.5',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <PanelLeftClose className="size-4 shrink-0" />
          )}
          <CollapsibleLabel collapsed={collapsed}>
            {collapsed ? 'Expand' : 'Collapse'}
          </CollapsibleLabel>
        </button>
      </div>
    </motion.aside>
  );
}
