import type { FolderDto } from '@/types/api';

export interface TreeFolder {
  folder: FolderDto;
  depth: number;
}

/**
 * Depth-first ordering of the folder tree: parents immediately followed by
 * their children, siblings sorted by name (the API returns name-sorted rows).
 * A folder whose parent is missing (shouldn't happen - deletes reparent)
 * falls back to the top level so it can never vanish from pickers.
 */
export function flattenFolderTree(items: FolderDto[]): TreeFolder[] {
  const childrenOf = new Map<string | null, FolderDto[]>();
  for (const folder of items) {
    const key = folder.parentId;
    const list = childrenOf.get(key) ?? [];
    list.push(folder);
    childrenOf.set(key, list);
  }

  const out: TreeFolder[] = [];
  const seen = new Set<string>();
  const visit = (folder: FolderDto, depth: number) => {
    if (seen.has(folder.id)) return;
    seen.add(folder.id);
    out.push({ folder, depth });
    for (const child of childrenOf.get(folder.id) ?? []) visit(child, depth + 1);
  };
  for (const root of childrenOf.get(null) ?? []) visit(root, 0);
  // Orphans from any data inconsistency still render, at the top level.
  for (const folder of items) visit(folder, 0);
  return out;
}

/** Full path label for selects: "Work / Clients / Acme". */
export function folderPath(folder: FolderDto, byId: Map<string, FolderDto>): string {
  const parts = [folder.name];
  let current = folder;
  const seen = new Set<string>([folder.id]);
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    parts.unshift(parent.name);
    current = parent;
  }
  return parts.join(' / ');
}

/** Ids of a folder and every descendant - excluded as move destinations. */
export function folderSubtreeIds(rootId: string, items: FolderDto[]): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const folder of items) {
    if (!folder.parentId) continue;
    const list = childrenOf.get(folder.parentId) ?? [];
    list.push(folder.id);
    childrenOf.set(folder.parentId, list);
  }
  const ids = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    for (const child of childrenOf.get(stack.pop()!) ?? []) {
      if (!ids.has(child)) {
        ids.add(child);
        stack.push(child);
      }
    }
  }
  return ids;
}
