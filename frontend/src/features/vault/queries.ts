import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useVault } from '@/features/vault/vault-context';
import { useWorkspace } from '@/features/workspace/workspace-context';
import { api } from '@/lib/api';
import type { EncryptedPayload } from '@/lib/crypto/vault';
import type {
  AttachmentDto,
  DashboardResponse,
  DecryptedSecret,
  FolderDto,
  FolderListResponse,
  SecretCategory,
  SecretDto,
  SecretListResponse,
  SecretPayload,
  SecretVersionDto,
  TrashResponse,
} from '@/types/api';
import type { VaultBackup } from '@/lib/importers';

export interface SecretFilters {
  query?: string;
  category?: SecretCategory | 'ALL';
  folderId?: string | 'none';
  tag?: string;
  favorite?: boolean;
  sort?: 'updated' | 'created' | 'title';
  limit?: number;
}

/** Mirrors backend MAX_SECRETS_PER_PAGE - larger values are a 400. */
const MAX_PAGE_SIZE = 100;

function toQuery(filters: SecretFilters): Record<string, string | number | boolean | undefined> {
  return {
    query: filters.query?.trim() || undefined,
    category: filters.category && filters.category !== 'ALL' ? filters.category : undefined,
    folderId: filters.folderId,
    tag: filters.tag,
    favorite: filters.favorite === undefined ? undefined : String(filters.favorite),
    sort: filters.sort,
    limit: filters.limit === undefined ? undefined : Math.min(filters.limit, MAX_PAGE_SIZE),
  };
}

/** Decrypts a page of secrets, keeping undecryptable rows visible and labelled. */
function useDecryptSecrets() {
  const { decrypt } = useVault();

  return useCallback(
    async (items: SecretDto[]): Promise<DecryptedSecret[]> =>
      Promise.all(
        items.map(async (item) => {
          try {
            const payload = await decrypt<SecretPayload>(item);
            return { ...item, payload };
          } catch {
            return {
              ...item,
              payload: null,
              decryptError:
                'This item was encrypted with a previous vault key and cannot be opened with your current password.',
            };
          }
        }),
      ),
    [decrypt],
  );
}

export function useSecrets(filters: SecretFilters = {}) {
  const { locked } = useVault();
  const { activeWorkspaceId } = useWorkspace();
  const decryptSecrets = useDecryptSecrets();

  return useQuery({
    queryKey: ['secrets', activeWorkspaceId, filters],
    enabled: !locked && activeWorkspaceId !== null,
    queryFn: async () => {
      // The API pages at 50 rows by default; a personal vault expects the full
      // list, so follow the cursor until exhausted (bounded so a pathological
      // account cannot spin forever). A caller-provided limit still caps the
      // total rows collected.
      const all: SecretDto[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 20; page += 1) {
        const response = await api.get<SecretListResponse>('/secrets', {
          query: { ...toQuery(filters), cursor },
        });
        all.push(...response.items);
        if (!response.nextCursor || (filters.limit !== undefined && all.length >= filters.limit)) break;
        cursor = response.nextCursor;
      }
      return {
        items: await decryptSecrets(filters.limit === undefined ? all : all.slice(0, filters.limit)),
      };
    },
  });
}

export function useFavoriteSecrets() {
  const { locked } = useVault();
  const { activeWorkspaceId } = useWorkspace();
  const decryptSecrets = useDecryptSecrets();

  return useQuery({
    queryKey: ['secrets', 'favorites', activeWorkspaceId],
    enabled: !locked && activeWorkspaceId !== null,
    queryFn: async () => {
      const response = await api.get<SecretListResponse>('/favorites');
      return decryptSecrets(response.items);
    },
  });
}

export function useSecret(id: string | undefined) {
  const { locked } = useVault();
  const { activeWorkspaceId } = useWorkspace();
  const decryptSecrets = useDecryptSecrets();

  return useQuery({
    queryKey: ['secret', activeWorkspaceId, id],
    enabled: Boolean(id) && !locked && activeWorkspaceId !== null,
    queryFn: async () => {
      const response = await api.get<{ secret: SecretDto }>(`/secrets/${id}`);
      const [decrypted] = await decryptSecrets([response.secret]);
      return decrypted as DecryptedSecret;
    },
  });
}

export interface SecretInput {
  title: string;
  category: SecretCategory;
  folderId?: string | null;
  tags?: string[];
  isFavorite?: boolean;
  payload: SecretPayload;
}

function useInvalidateVault() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['secrets'] });
    void queryClient.invalidateQueries({ queryKey: ['secret'] });
    void queryClient.invalidateQueries({ queryKey: ['trash'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['folders'] });
    void queryClient.invalidateQueries({ queryKey: ['activity'] });
    void queryClient.invalidateQueries({ queryKey: ['activity-heatmap'] });
    void queryClient.invalidateQueries({ queryKey: ['versions'] });
    void queryClient.invalidateQueries({ queryKey: ['attachments'] });
  }, [queryClient]);
}

export function useCreateSecret() {
  const { encrypt } = useVault();
  const invalidate = useInvalidateVault();
  const { keyVersion } = useVaultKeyVersion();

  return useMutation({
    mutationFn: async (input: SecretInput) => {
      const encrypted = await encrypt(input.payload);
      const response = await api.post<{ secret: SecretDto }>('/secrets', {
        title: input.title,
        category: input.category,
        folderId: input.folderId ?? null,
        tags: input.tags ?? [],
        isFavorite: input.isFavorite ?? false,
        keyVersion,
        ...encrypted,
      });
      return response.secret;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateSecret() {
  const { encrypt } = useVault();
  const invalidate = useInvalidateVault();
  const { keyVersion } = useVaultKeyVersion();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
      ...rest
    }: Partial<Omit<SecretInput, 'payload'>> & { id: string; payload?: SecretPayload }) => {
      const encrypted: EncryptedPayload | undefined = payload ? await encrypt(payload) : undefined;

      const response = await api.patch<{ secret: SecretDto }>(`/secrets/${id}`, {
        ...rest,
        ...(encrypted ? { ...encrypted, keyVersion } : {}),
      });
      return response.secret;
    },
    onSuccess: invalidate,
  });
}

/** Soft-delete: the item moves to the trash and can be restored for 30 days. */
export function useDeleteSecret() {
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/secrets/${id}`),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Trash (30-day soft-delete window)
// ---------------------------------------------------------------------------

export function useTrash() {
  const { locked } = useVault();
  const { activeWorkspaceId } = useWorkspace();
  const decryptSecrets = useDecryptSecrets();

  return useQuery({
    queryKey: ['trash', activeWorkspaceId],
    enabled: !locked && activeWorkspaceId !== null,
    queryFn: async () => {
      const response = await api.get<TrashResponse>('/secrets/trash');
      return {
        items: await decryptSecrets(response.items),
        retentionDays: response.retentionDays,
      };
    },
  });
}

export function useRestoreSecret() {
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: (id: string) => api.post<{ secret: SecretDto }>(`/secrets/${id}/restore`),
    onSuccess: invalidate,
  });
}

/** Irreversible hard delete - only works on items already in the trash. */
export function usePurgeSecret() {
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/secrets/${id}/permanent`),
    onSuccess: invalidate,
  });
}

export function useEmptyTrash() {
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: () => api.delete<{ purged: number }>('/secrets/trash'),
    onSuccess: invalidate,
  });
}

export function useToggleFavorite() {
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      api.patch<{ secret: SecretDto }>(`/secrets/${id}`, { isFavorite }),
    onSuccess: invalidate,
  });
}

export function useMoveSecret() {
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      api.patch<{ secret: SecretDto }>(`/secrets/${id}`, { folderId }),
    onSuccess: invalidate,
  });
}

/**
 * Bulk refile / favourite / cross-organisation move. Only row metadata is
 * sent - ciphertext never leaves the browser for these operations.
 */
export function useBulkUpdateSecrets() {
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: (body: {
      ids: string[];
      folderId?: string | null;
      workspaceId?: string;
      isFavorite?: boolean;
    }) => api.patch<{ updated: number }>('/secrets/bulk', body),
    onSuccess: invalidate,
  });
}

/** Bulk soft-delete - every selected item lands in the trash. */
export function useBulkDeleteSecrets() {
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: (ids: string[]) => api.delete<{ trashed: number }>('/secrets/bulk', { body: { ids } }),
    onSuccess: invalidate,
  });
}

/** Server-side ciphertext copy - attachments are not duplicated. */
export function useBulkDuplicateSecrets() {
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: (ids: string[]) => api.post<{ created: number }>('/secrets/bulk/duplicate', { ids }),
    onSuccess: invalidate,
  });
}

/** Bulk create, used by `.env`/CSV import. Each entry is encrypted individually. */
export function useImportSecrets() {
  const { encrypt } = useVault();
  const invalidate = useInvalidateVault();
  const { keyVersion } = useVaultKeyVersion();

  return useMutation({
    mutationFn: async ({
      inputs,
      source = 'env-import',
    }: {
      inputs: SecretInput[];
      source?: 'env-import' | 'csv-import' | 'backup-restore';
    }) => {
      let created = 0;
      // The API caps a bulk call at MAX_SECRETS_PER_IMPORT items - chunk it.
      for (let start = 0; start < inputs.length; start += 200) {
        const chunk = inputs.slice(start, start + 200);
        const items = await Promise.all(
          chunk.map(async (input) => ({
            title: input.title,
            category: input.category,
            folderId: input.folderId ?? null,
            tags: input.tags ?? [],
            isFavorite: false,
            keyVersion,
            ...(await encrypt(input.payload)),
          })),
        );

        const response = await api.post<{ created: number }>('/secrets/bulk', { items, source });
        created += response.created;
      }
      return { created };
    },
    onSuccess: invalidate,
  });
}

export function useSecretVersions(id: string | undefined) {
  const { locked, decrypt } = useVault();
  const { activeWorkspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['versions', activeWorkspaceId, id],
    enabled: Boolean(id) && !locked && activeWorkspaceId !== null,
    queryFn: async () => {
      const response = await api.get<{ current: SecretDto; items: SecretVersionDto[] }>(`/secrets/${id}/versions`);

      return Promise.all(
        response.items.map(async (version) => {
          try {
            return { ...version, payload: await decrypt<SecretPayload>(version) };
          } catch {
            return { ...version, payload: null };
          }
        }),
      );
    },
  });
}

export function useRestoreVersion() {
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: ({ id, versionId }: { id: string; versionId: string }) =>
      api.post<{ secret: SecretDto }>(`/secrets/${id}/versions/${versionId}/restore`),
    onSuccess: invalidate,
  });
}

/**
 * Restores an encrypted Vaultory backup: missing folders are recreated by
 * name, ciphertext rows go back through the bulk endpoint untouched, and
 * attachment blobs are re-uploaded under their new parent ids.
 */
export function useRestoreBackup() {
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: async (backup: VaultBackup) => {
      const { items: existing } = await api.get<FolderListResponse>('/folders');
      const folderIds = new Map(existing.map((folder) => [folder.name, folder.id]));
      for (const folder of backup.folders) {
        if (folderIds.has(folder.name)) continue;
        const res = await api.post<{ folder: FolderDto }>('/folders', {
          name: folder.name,
          color: folder.color,
        });
        folderIds.set(folder.name, res.folder.id);
      }

      const createdIds: string[] = [];
      for (let start = 0; start < backup.secrets.length; start += 200) {
        const chunk = backup.secrets.slice(start, start + 200).map((secret) => ({
          title: secret.title,
          category: secret.category,
          tags: secret.tags,
          isFavorite: secret.isFavorite,
          folderId: secret.folder ? (folderIds.get(secret.folder) ?? null) : null,
          encVersion: secret.encVersion,
          keyVersion: secret.keyVersion,
          nonce: secret.nonce,
          ciphertext: secret.ciphertext,
        }));
        const res = await api.post<{ items: SecretDto[]; created: number }>('/secrets/bulk', {
          items: chunk,
          source: 'backup-restore',
        });
        createdIds.push(...res.items.map((item) => item.id));
      }

      let attached = 0;
      for (const attachment of backup.attachments) {
        const secretId = createdIds[attachment.secretIndex];
        if (!secretId) continue;
        await api.post(`/secrets/${secretId}/attachments`, {
          fileName: attachment.fileName,
          mimeType: attachment.mimeType ?? undefined,
          size: attachment.size,
          encVersion: attachment.encVersion,
          keyVersion: attachment.keyVersion,
          nonce: attachment.nonce,
          ciphertext: attachment.ciphertext,
        });
        attached += 1;
      }

      return { created: createdIds.length, attached };
    },
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Encrypted file attachments (.env files, PEM/PPK keys, keystores, VPN configs)
// ---------------------------------------------------------------------------

/** Metadata-only list; ciphertext is fetched per-file on download. */
export function useAttachments(secretId: string | undefined) {
  const { locked } = useVault();
  const { activeWorkspaceId } = useWorkspace();

  return useQuery({
    queryKey: ['attachments', activeWorkspaceId, secretId],
    enabled: Boolean(secretId) && !locked && activeWorkspaceId !== null,
    queryFn: async () => {
      const response = await api.get<{ items: AttachmentDto[] }>(`/secrets/${secretId}/attachments`);
      return response.items;
    },
  });
}

/** Encrypts the file bytes in the browser, then uploads the ciphertext blob. */
export function useUploadAttachment(secretId: string) {
  const { encryptFile } = useVault();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateVault();
  const { keyVersion } = useVaultKeyVersion();

  return useMutation({
    mutationFn: async (file: File) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const encrypted = await encryptFile(bytes);

      const response = await api.post<{ attachment: AttachmentDto }>(`/secrets/${secretId}/attachments`, {
        fileName: file.name,
        mimeType: file.type || undefined,
        size: bytes.byteLength,
        keyVersion,
        ...encrypted,
      });
      return response.attachment;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attachments'] });
      invalidate();
    },
  });
}

/**
 * Fetches the ciphertext for one attachment and decrypts it, returning the raw
 * bytes plus the display metadata needed to offer a download.
 */
export async function downloadAttachment(
  secretId: string,
  attachmentId: string,
  decryptFile: (payload: EncryptedPayload) => Promise<Uint8Array>,
) {
  const { attachment } = await api.get<{ attachment: AttachmentDto & { ciphertext: string } }>(
    `/secrets/${secretId}/attachments/${attachmentId}`,
  );
  const bytes = await decryptFile(attachment);
  return { bytes, fileName: attachment.fileName, mimeType: attachment.mimeType };
}

export function useDeleteAttachment(secretId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateVault();

  return useMutation({
    mutationFn: (attachmentId: string) =>
      api.delete<void>(`/secrets/${secretId}/attachments/${attachmentId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attachments'] });
      invalidate();
    },
  });
}

export function useDashboard() {
  const { locked } = useVault();
  const { activeWorkspaceId } = useWorkspace();
  const decryptSecrets = useDecryptSecrets();

  return useQuery({
    queryKey: ['dashboard', activeWorkspaceId],
    enabled: !locked && activeWorkspaceId !== null,
    queryFn: async () => {
      const response = await api.get<DashboardResponse>('/dashboard');
      return { ...response, recentSecrets: await decryptSecrets(response.recentSecrets) };
    },
  });
}

/** Records a client-side export in the activity log (no values are sent). */
export function useRecordExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (count: number) => api.post<{ recorded: boolean }>('/activity', { type: 'SECRETS_EXPORTED', count }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activity'] }),
  });
}

/**
 * Current vault key generation, stamped onto every new ciphertext so a later
 * key rotation can tell which rows it can no longer decrypt.
 */
export function useVaultKeyVersion(): { keyVersion: number } {
  const user = useCurrentUser();
  return { keyVersion: user.vaultKeyVersion };
}
