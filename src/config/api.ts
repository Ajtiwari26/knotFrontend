const PRODUCTION_URL = 'https://knot-kbm1.onrender.com';
const LOCAL_URL = 'http://localhost:3001';

let _resolvedBaseUrl: string | null = null;

/**
 * Probes the local dev server first. If it responds within 3s, use it.
 * Otherwise, fall back to the production Render URL.
 */
export async function resolveBaseUrl(): Promise<string> {
  if (_resolvedBaseUrl) return _resolvedBaseUrl;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout for local check
    const res = await fetch(`${LOCAL_URL}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      console.log('[API] Using local backend:', LOCAL_URL);
      _resolvedBaseUrl = LOCAL_URL;
      return _resolvedBaseUrl;
    }
  } catch (e) {
    console.warn('[API] Local backend probe failed, falling back to production.');
  }

  console.log('[API] Using production URL:', PRODUCTION_URL);
  _resolvedBaseUrl = PRODUCTION_URL;
  return _resolvedBaseUrl;
}

/** Get the current API base URL (call after resolveBaseUrl) */
export function getBaseUrl(): string {
  return _resolvedBaseUrl || PRODUCTION_URL;
}

/** Initialize the API config — call once at app startup */
export async function initApiConfig(): Promise<string> {
  return resolveBaseUrl();
}

export const API_URL = PRODUCTION_URL; // Sync fallback
export const SOCKET_URL = PRODUCTION_URL;

export default { API_URL, SOCKET_URL, initApiConfig, getBaseUrl };
