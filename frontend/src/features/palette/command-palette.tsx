import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  Download,
  FileKey2,
  Folder,
  HeartPulse,
  Share2,
  LayoutDashboard,
  Lock,
  Moon,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/app/theme-context';
import { useVault } from '@/features/vault/vault-context';
import { categoryMeta, secretSubtitle } from '@/features/vault/categories';
import { useSecrets } from '@/features/vault/queries';
import { rankItems } from '@/features/palette/rank';
import { cn } from '@/lib/utils';
import type { SecretPayload } from '@/types/api';

interface Action {
  id: string;
  title: string;
  subtitle?: string | null;
  keywords: string[];
  icon: typeof Plus;
  run: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el?.closest('input, textarea, select, [contenteditable="true"]'));
}

/**
 * Global keyboard shortcuts + the Ctrl/Cmd+K palette itself.
 * Mounted once inside the app shell so it works on every page.
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const { locked, lock } = useVault();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const secrets = useSecrets({ limit: 100, sort: 'updated' });

  // --- Global shortcuts -----------------------------------------------------
  useEffect(() => {
    const open = () => setOpen(true);
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (event.key === '/') {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === 'N' /* shift+n */) {
        event.preventDefault();
        void navigate('/vault/new');
      } else if (event.key === 'L' /* shift+l */ && !locked) {
        event.preventDefault();
        void lock('manual');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('vaultory:open-palette', open);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('vaultory:open-palette', open);
    };
  }, [navigate, locked, lock]);

  // --- Actions --------------------------------------------------------------
  const actions = useMemo<Action[]>(() => {
    const go = (path: string) => () => void navigate(path);
    const list: Action[] = [
      { id: 'new', title: 'New secret', subtitle: 'Encrypt and save an item', keywords: ['add', 'create', 'password'], icon: Plus, run: go('/vault/new') },
      { id: 'vault', title: 'Vault', keywords: ['passwords', 'items', 'list'], icon: FileKey2, run: go('/vault') },
      { id: 'import', title: 'Import', subtitle: '.env, Bitwarden or Chrome CSV, backup', keywords: ['csv', 'env', 'bitwarden', 'chrome', 'restore'], icon: Upload, run: go('/vault?import=1') },
      { id: 'export', title: 'Export / backup', keywords: ['download', 'backup', 'env'], icon: Download, run: go('/vault?export=1') },
      { id: 'dashboard', title: 'Dashboard', keywords: ['home', 'stats', 'overview'], icon: LayoutDashboard, run: go('/dashboard') },
      { id: 'health', title: 'Password health', subtitle: 'Audit, reuse and breach check', keywords: ['audit', 'weak', 'reused', 'breach', 'security'], icon: HeartPulse, run: go('/audit') },
      { id: 'sharing', title: 'Sharing', subtitle: 'Incoming and sent shares', keywords: ['share', 'shared', 'send'], icon: Share2, run: go('/sharing') },
      { id: 'folders', title: 'Folders', keywords: ['organise', 'collections'], icon: Folder, run: go('/folders') },
      { id: 'favorites', title: 'Favorites', keywords: ['starred', 'pinned'], icon: Star, run: go('/favorites') },
      { id: 'activity', title: 'Activity', keywords: ['history', 'events', 'log'], icon: Activity, run: go('/activity') },
      { id: 'trash', title: 'Trash', subtitle: 'Recover deleted items', keywords: ['deleted', 'restore', 'bin'], icon: Trash2, run: go('/trash') },
      { id: 'settings', title: 'Settings', keywords: ['account', 'password', '2fa', 'totp', 'sessions'], icon: Settings, run: go('/settings') },
      {
        id: 'theme',
        title: resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        keywords: ['theme', 'dark', 'light', 'appearance'],
        icon: resolvedTheme === 'dark' ? Sun : Moon,
        run: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
      },
    ];
    if (!locked) {
      list.push({
        id: 'lock',
        title: 'Lock vault',
        subtitle: 'Wipe the decrypted key from this device',
        keywords: ['lock', 'secure', 'close'],
        icon: Lock,
        run: () => void lock('manual'),
      });
    }
    return list;
  }, [navigate, locked, lock, resolvedTheme, setTheme]);

  // --- Results --------------------------------------------------------------
  const secretResults = useMemo(
    () =>
      locked
        ? []
        : rankItems(
            query,
            (secrets.data?.items ?? [])
              .filter((item) => !item.decryptError)
              .map((item) => ({
                id: item.id,
                title: item.title,
                subtitle:
                  secretSubtitle(item.category, item.payload as SecretPayload | null) ??
                  categoryMeta(item.category).short,
                keywords: item.tags,
                secret: item,
              })),
          ),
    [query, secrets.data, locked],
  );
  const actionResults = useMemo(() => rankItems(query, actions), [query, actions]);
  const total = secretResults.length + actionResults.length;
  // Clamp instead of resetting in an effect: typing shrinks the result list.
  const active = Math.min(selected, Math.max(total - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  interface Row {
    key: string;
    index: number;
    title: string;
    subtitle: string | null;
    icon: typeof Plus;
    accent: string;
    favorite?: boolean;
  }

  const secretRows = useMemo<Row[]>(
    () =>
      secretResults.map((item, i) => {
        const meta = categoryMeta(item.secret.category);
        return {
          key: `s-${item.id}`,
          index: i,
          title: item.title,
          subtitle: item.subtitle ?? null,
          icon: meta.icon,
          accent: meta.accent,
          favorite: item.secret.isFavorite,
        };
      }),
    [secretResults],
  );
  const actionRows = useMemo<Row[]>(
    () =>
      actionResults.map((action, i) => ({
        key: `a-${action.id}`,
        index: i + secretResults.length,
        title: action.title,
        subtitle: action.subtitle ?? null,
        icon: action.icon,
        accent: 'border-line bg-surface text-fg-muted',
      })),
    [actionResults, secretResults.length],
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setQuery('');
    setSelected(0);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelected(0);
  };

  const pick = (index: number) => {
    if (index < secretResults.length) {
      const item = secretResults[index]!;
      handleOpenChange(false);
      void navigate(`/vault/${item.secret.id}`);
      return;
    }
    const action = actionResults[index - secretResults.length];
    if (action) {
      handleOpenChange(false);
      action.run();
    }
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected(Math.min(active + 1, total - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected(Math.max(active - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick(active);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0b0b14]/55 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className="fixed top-[12dvh] left-1/2 z-50 flex max-h-[70dvh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-elevated shadow-pop"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search secrets and run actions.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2.5 border-b border-line px-4">
            <Search className="size-4 shrink-0 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={onListKeyDown}
              placeholder={locked ? 'Search actions…' : 'Search secrets or type a command…'}
              className="h-12 w-full bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-subtle"
              aria-label="Command palette search"
            />
            <kbd className="shrink-0 rounded border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">
              esc
            </kbd>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2" role="listbox">
            {total === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-fg-muted">
                {locked ? 'Unlock the vault to search secrets. Actions still work.' : 'No matches.'}
              </p>
            ) : null}

            {(
              [
                ['Secrets', secretRows],
                ['Actions', actionRows],
              ] as const
            ).map(([label, section]) =>
              section.length === 0 ? null : (
                <div key={label}>
                  <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
                    {label}
                  </p>
                  {section.map((row) => (
                    <button
                      key={row.key}
                      type="button"
                      role="option"
                      aria-selected={active === row.index}
                      data-index={row.index}
                      onClick={() => pick(row.index)}
                      onMouseMove={() => setSelected(row.index)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left',
                        active === row.index && 'bg-primary-soft',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-md border',
                          row.accent,
                        )}
                      >
                        <row.icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-fg">{row.title}</span>
                        {row.subtitle ? (
                          <span className="block truncate text-[11px] text-fg-subtle">{row.subtitle}</span>
                        ) : null}
                      </span>
                      {row.favorite ? <Star className="size-3 shrink-0 fill-warning text-warning" /> : null}
                    </button>
                  ))}
                </div>
              ),
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-fg-subtle">
            <span className="flex items-center gap-1">
              <ArrowUp className="size-3" />
              <ArrowDown className="size-3" /> navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="size-3" /> open
            </span>
            <span className="ml-auto hidden sm:block">Shift+N new · Shift+L lock</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
