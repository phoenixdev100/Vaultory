const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

/** Raw URL for non-fetch consumers (<img src>) hitting the favicon proxy. */
export function faviconUrl(domain: string): string {
  return `${BASE_URL}/meta/favicon?domain=${encodeURIComponent(domain)}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Array<{ field: string; message: string }>;

  constructor(status: number, code: string, message: string, details?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/**
 * CSRF token for the current session. Kept in memory only: a cross-site
 * deployment cannot read the API's cookies from JavaScript, and localStorage
 * would survive logout.
 */
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

const WORKSPACE_STORAGE_KEY = 'vaultory.workspace';

/**
 * Active workspace ("organisation") sent on every API request as
 * X-Workspace-Id. Initialised synchronously from localStorage so the very
 * first request after a reload is already scoped correctly; the workspace
 * provider keeps it in sync afterwards and clears it on logout.
 */
let workspaceId: string | null = null;
try {
  workspaceId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
} catch {
  workspaceId = null;
}

export function getActiveWorkspaceId(): string | null {
  return workspaceId;
}

export function setActiveWorkspaceId(id: string | null): void {
  workspaceId = id;
  try {
    if (id) localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
    else localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export const UNAUTHORIZED_EVENT = 'vaultory:unauthorized';

interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Skip the global "session expired" broadcast (used by the boot-time /me probe). */
  silentUnauthorized?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `${url}?${serialized}` : url;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      // Session lives in an httpOnly cookie.
      credentials: 'include',
      cache: 'no-store',
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', 'Could not reach the Vaultory API. Check your connection.');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // A proxy/edge can answer with HTML (e.g. a 502 page) - surface it as a
      // normal API error instead of crashing the caller with a SyntaxError.
      throw new ApiError(response.status, 'bad_response', 'The server returned an unexpected response.');
    }
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    if (response.status === 401 && !options.silentUnauthorized) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(
      response.status,
      error?.code ?? 'request_failed',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.details as Array<{ field: string; message: string }> | undefined,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};
