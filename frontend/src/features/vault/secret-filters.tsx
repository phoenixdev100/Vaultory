import { ArrowDownAZ, Folder, Search, Star, Tag, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { flattenFolderTree, folderPath } from '@/features/folders/tree';
import { CATEGORY_LIST } from '@/features/vault/categories';
import type { SecretFilters } from '@/features/vault/queries';
import { cn } from '@/lib/utils';
import type { FolderDto, SecretCategory } from '@/types/api';

interface SecretFiltersBarProps {
  filters: SecretFilters;
  onChange: (filters: SecretFilters) => void;
  folders: FolderDto[];
  tags?: string[];
  className?: string;
}

/** Search + category/folder/tag/sort controls. Search is debounced locally. */
export function SecretFiltersBar({ filters, onChange, folders, tags = [], className }: SecretFiltersBarProps) {
  // `draft` owns the query text; it is pushed into `filters` after a debounce.
  const [draft, setDraft] = useState(filters.query ?? '');
  const byId = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const query = draft.trim();
      if ((filters.query ?? '') !== query) onChange({ ...filters, query: query === '' ? undefined : query });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [draft, filters, onChange]);

  const active =
    Boolean(filters.query) ||
    (filters.category !== undefined && filters.category !== 'ALL') ||
    filters.folderId !== undefined ||
    filters.tag !== undefined ||
    filters.favorite === true;

  function patch(next: Partial<SecretFilters>) {
    onChange({ ...filters, ...next });
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="relative min-w-48 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search titles and tags…"
          className="h-8 pl-8 text-[13px]"
          aria-label="Search vault"
        />
      </div>

      <Select
        value={filters.category ?? 'ALL'}
        onValueChange={(value) => patch({ category: value as SecretCategory | 'ALL' })}
      >
        <SelectTrigger size="sm" className="w-40 flex-1 sm:flex-none" aria-label="Filter by category">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All categories</SelectItem>
          {CATEGORY_LIST.map((meta) => (
            <SelectItem key={meta.category} value={meta.category} icon={<meta.icon />}>
              {meta.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.folderId ?? 'any'}
        onValueChange={(value) => patch({ folderId: value === 'any' ? undefined : value })}
      >
        <SelectTrigger size="sm" className="w-36 flex-1 sm:flex-none" aria-label="Filter by folder">
          <SelectValue placeholder="Folder" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any" icon={<Folder />}>
            Any folder
          </SelectItem>
          <SelectItem value="none">No folder</SelectItem>
          {flattenFolderTree(folders).map(({ folder }) => (
            <SelectItem key={folder.id} value={folder.id}>
              {folderPath(folder, byId)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {tags.length > 0 ? (
        <Select
          value={filters.tag ?? 'any'}
          onValueChange={(value) => patch({ tag: value === 'any' ? undefined : value })}
        >
          <SelectTrigger size="sm" className="w-32 flex-1 sm:flex-none" aria-label="Filter by tag">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any" icon={<Tag />}>
              Any tag
            </SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Select
        value={filters.sort ?? 'updated'}
        onValueChange={(value) => patch({ sort: value as SecretFilters['sort'] })}
      >
        <SelectTrigger size="sm" className="w-44 flex-1 sm:flex-none" aria-label="Sort order">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="updated" icon={<ArrowDownAZ />}>
            Recently updated
          </SelectItem>
          <SelectItem value="created">Recently created</SelectItem>
          <SelectItem value="title">Title A–Z</SelectItem>
        </SelectContent>
      </Select>

      <Tooltip content="Favorites only">
        <Button
          variant={filters.favorite ? 'soft' : 'secondary'}
          size="icon-sm"
          onClick={() => patch({ favorite: filters.favorite ? undefined : true })}
          aria-pressed={filters.favorite === true}
          aria-label="Show favorites only"
        >
          <Star className={cn(filters.favorite && 'fill-warning text-warning')} />
        </Button>
      </Tooltip>

      {active ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraft('');
            onChange({ sort: filters.sort });
          }}
        >
          <X />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
