import { getAccessToken, getApiBaseUrl } from '@inji-offline-verify/shared-auth';

export interface RegisterWorkerPayload {
  org_name: string;
  username: string;
  password: string;
  email: string;
  full_name: string;
  phone_number: string;
  gender?: 'M' | 'F' | 'O' | string;
  dob?: string; // YYYY-MM-DD
}

export async function registerWorker(payload: RegisterWorkerPayload) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error('API base URL not set. Please login first.');

  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated. Missing access token.');

  const res = await fetch(`${baseUrl}/worker/api/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to register worker: ${res.status}`);
  }
  return res.json();
}
