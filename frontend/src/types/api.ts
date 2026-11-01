export type SecretCategory =
  | 'LOGIN'
  | 'API_KEY'
  | 'DATABASE'
  | 'SERVER_SSH'
  | 'CLOUD'
  | 'ENV_VARS'
  | 'WIFI_VPN'
  | 'PRIVATE_KEY'
  | 'RECOVERY_CODE'
  | 'LICENSE_KEY'
  | 'PAYMENT'
  | 'EMAIL_SERVICE'
  | 'IDENTITY'
  | 'MOBILE'
  | 'CRYPTO'
  | 'PERSONAL'
  | 'SECURE_NOTE'
  | 'CUSTOM';

export type ActivityEventType =
  | 'SIGNUP'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'EMAIL_VERIFIED'
  | 'SESSION_REVOKED'
  | 'SESSIONS_REVOKED_OTHERS'
  | 'SETTINGS_UPDATED'
  | 'SECRET_CREATED'
  | 'SECRET_UPDATED'
  | 'SECRET_DELETED'
  | 'SECRET_RESTORED'
  | 'SECRETS_IMPORTED'
  | 'SECRETS_EXPORTED'
  | 'FOLDER_CREATED'
  | 'FOLDER_RENAMED'
  | 'FOLDER_DELETED'
  | 'ATTACHMENT_UPLOADED'
  | 'ATTACHMENT_DELETED'
  | 'SECRET_TRASHED'
  | 'SECRET_PURGED'
  | 'VAULT_KEY_ROTATED'
  | 'TOTP_ENABLED'
  | 'TOTP_DISABLED'
  | 'SHARE_SENT'
  | 'SHARE_ACCEPTED'
  | 'SHARE_REVOKED'
  | 'EMERGENCY_GRANTED'
  | 'EMERGENCY_REQUESTED'
  | 'EMERGENCY_APPROVED'
  | 'EMERGENCY_CANCELLED'
  | 'EMERGENCY_USED';

export interface KdfParamsDto {
  algorithm: 'argon2id';
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  totpEnabled: boolean;
  autoLockMinutes: number;
  theme: 'light' | 'dark' | string;
  vaultKeyVersion: number;
  wrappedVaultKey: string;
  /** ECDH P-256 share key - published so others can encrypt shares to us. */
  sharePublicKey: string | null;
  sharePrivateKeyWrapped: { nonce: string; ciphertext: string } | null;
  kdf: KdfParamsDto;
  passwordChangedAt: string;
  createdAt: string;
}

/** A secret as stored: metadata in the clear, everything else as ciphertext. */
export interface SecretDto {
  id: string;
  title: string;
  category: SecretCategory;
  tags: string[];
  isFavorite: boolean;
  folderId: string | null;
  /** Which workspace (organisation) this item lives in. */
  workspaceId: string;
  encVersion: 1;
  keyVersion: number;
  nonce: string;
  ciphertext: string;
  version: number;
  /** Set when the item is in the trash; null for live items. */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Encrypted file attached to a secret (.env, PEM/PPK, keystore, VPN config…).
 * `fileName`/`size`/`mimeType` are plaintext metadata like the secret title;
 * `ciphertext` is only present on the single-download response.
 */
export interface AttachmentDto {
  id: string;
  secretId: string;
  fileName: string;
  mimeType: string | null;
  /** Original plaintext byte size. */
  size: number;
  encVersion: 1;
  keyVersion: number;
  nonce: string;
  ciphertext?: string;
  createdAt: string;
}

export interface SecretVersionDto {
  id: string;
  secretId: string;
  version: number;
  title: string;
  category: SecretCategory;
  encVersion: 1;
  keyVersion: number;
  nonce: string;
  ciphertext: string;
  createdAt: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  color: string | null;
  isDefault: boolean;
  secretCount?: number;
  folderCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceListResponse {
  items: WorkspaceDto[];
}

export interface FolderDto {
  id: string;
  name: string;
  color: string | null;
  /** Nested folders: null = top level. */
  parentId: string | null;
  secretCount: number;
  subfolderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityDto {
  id: string;
  type: ActivityEventType;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  ipLabel: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface SessionDto {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipLabel: string | null;
  /** ISO alpha-2 country from the edge geo header; null when unknown/local. */
  country: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface AuthResponse {
  user: UserDto;
  csrfToken: string;
}

/** /auth/login answers either a session or a TOTP challenge. */
export type LoginResponse =
  | AuthResponse
  | { mfaRequired: true; mfaToken: string };

export interface TrashResponse {
  items: SecretDto[];
  retentionDays: number;
}

export interface MeResponse {
  user: UserDto;
  csrfToken: string;
  session: SessionDto;
}

/** A share row as the server holds it - title in the clear, payload ciphertext-only. */
export interface ShareDto {
  id: string;
  title: string;
  category: SecretCategory;
  senderPublicKey: string;
  nonce: string;
  ciphertext: string;
  status: 'PENDING' | 'ACCEPTED';
  createdAt: string;
  expiresAt: string | null;
  peer: { email: string; name: string | null };
}

export interface ShareListResponse {
  incoming: ShareDto[];
  outgoing: ShareDto[];
}

export interface ShareLookupResponse {
  email: string;
  name: string | null;
  sharePublicKey: string;
}

export interface SecretListResponse {
  items: SecretDto[];
  nextCursor: string | null;
  vaultKeyVersion: number;
}

export interface FolderListResponse {
  items: FolderDto[];
  unfiledCount: number;
}

export interface ActivityListResponse {
  items: ActivityDto[];
  nextCursor: string | null;
}

export interface DashboardResponse {
  counts: {
    secrets: number;
    favorites: number;
    folders: number;
    attachments: number;
    trash: number;
    strandedSecrets: number;
  };
  categories: Array<{ category: SecretCategory; count: number }>;
  recentSecrets: SecretDto[];
  recentActivity: ActivityDto[];
  security: {
    passkeyCount: number;
    /** ISO date of the most recent SECRETS_EXPORTED event; null if never. */
    lastExportAt: string | null;
  };
}

export interface HeatmapResponse {
  /** ISO `YYYY-MM-DD` -> event count. */
  days: Record<string, number>;
  truncated: boolean;
}

export interface SettingsResponse {
  user: UserDto;
  stats: {
    secretCount: number;
    folderCount: number;
    favoriteCount: number;
    sessionCount: number;
    strandedSecrets: number;
  };
  security: { encryption: string; keyDerivation: string; recovery: string };
}

/** Decrypted secret body. Lives in memory only, never persisted as plaintext. */
export interface SecretPayload {
  v: 1;
  fields: Record<string, string>;
  custom?: Array<{ key: string; value: string; masked?: boolean }>;
  notes?: string;
}

/** A secret joined with its decrypted payload for rendering. */
export interface DecryptedSecret extends SecretDto {
  payload: SecretPayload | null;
  /** Set when decryption failed (for example after a password reset). */
  decryptError?: string;
}
