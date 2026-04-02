function isLocalHostName(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function isLocalBackendUrl(value: string): boolean {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return isLocalHostName(parsed.hostname);
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
  }
}

function isLocalBrowserSession(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return isLocalHostName(window.location.hostname);
}

function resolveBackendUrl(): string {
  const configuredValue = (import.meta.env.VITE_BACKEND_URL ?? '').trim().replace(/\/$/, '');

  if (!configuredValue) {
    return '';
  }

  if (!isLocalBrowserSession() && isLocalBackendUrl(configuredValue)) {
    return '';
  }

  return configuredValue;
}

const configuredBackendUrl = resolveBackendUrl();

export function getApiUrl(endpoint: string): string {
  return configuredBackendUrl ? `${configuredBackendUrl}${endpoint}` : endpoint;
}

export function hasConfiguredBackend(): boolean {
  return configuredBackendUrl.length > 0;
}

export function getConfiguredBackendUrl(): string {
  return configuredBackendUrl;
}
