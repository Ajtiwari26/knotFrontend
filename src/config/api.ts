const PRODUCTION_URL = 'https://knot-kbm1.onrender.com';
const LOCAL_URL = 'http://10.102.241.38:3001';

let _resolvedBaseUrl: string | null = null;

/**
 * Probes the local dev server first. If it responds within 2s, use it.
 * Otherwise, fall back to the production Render URL.
 */
export async function resolveBaseUrl(): Promise<string> {
  if (_resolvedBaseUrl) return _resolvedBaseUrl;

  // Enforce production URL directly
  console.log('[API] Forcing production URL:', PRODUCTION_URL);
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
