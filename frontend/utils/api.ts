const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

let authToken: string | null = null;

export function setAuthToken(token: string) {
  authToken = token;
}

export function clearAuthToken() {
  authToken = null;
}

async function request(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const url = `${BACKEND_URL}${endpoint}`;
  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
    const detail = errorData.detail;
    let message: string;
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail.map((e: any) => e?.msg || JSON.stringify(e)).join(' ');
    } else {
      message = 'Something went wrong';
    }
    throw new Error(message);
  }

  return response.json();
}

export function apiGet(endpoint: string) {
  return request(endpoint, { method: 'GET' });
}

export function apiPost(endpoint: string, body: any) {
  return request(endpoint, { method: 'POST', body: JSON.stringify(body) });
}

export function apiDelete(endpoint: string) {
  return request(endpoint, { method: 'DELETE' });
}
