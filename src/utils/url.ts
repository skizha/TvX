// URL utilities

/**
 * Normalize server URL (ensure http/https, remove trailing slash)
 */
export function normalizeServerUrl(url: string): string {
  let normalized = url.trim();

  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `http://${normalized}`;
  }

  // Remove trailing slash
  normalized = normalized.replace(/\/+$/, '');

  return normalized;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Mask credentials in URL for display
 */
export function maskCredentials(url: string): string {
  // Match patterns like /username/password/ or ?username=x&password=y
  return url
    .replace(/\/([^/]+)\/([^/]+)\/(\d+)\./, '/***/***/***/$3.')
    .replace(/username=[^&]+/, 'username=***')
    .replace(/password=[^&]+/, 'password=***');
}
