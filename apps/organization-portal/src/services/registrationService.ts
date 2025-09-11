// Organization-specific registration functions
import { setApiBaseUrl, saveTokens } from '@inji-offline-verify/shared-auth';

export async function registerOrganization(baseUrl: string, payload: {
  org_name: string;
  admin_username: string;
  admin_password: string;
  admin_email: string;
}) {
  console.log('Making registration request to:', `${baseUrl}/api/auth/register/`);
  console.log('Request payload:', JSON.stringify(payload, null, 2));
  
  const res = await fetch(`${baseUrl}/api/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  console.log('Response status:', res.status);
  console.log('Response headers:', res.headers);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Registration failed. Response:', errorText);
    throw new Error(`Register failed: ${res.status} - ${errorText}`);
  }
  
  const data = await res.json();
  console.log('Registration successful. Response:', data);
  
  // Return the pending registration data (no tokens yet)
  return data;
}

export async function confirmRegistration(baseUrl: string, payload: {
  pending_id: string;
  otp_code: string;
}) {
  console.log('Making OTP confirmation request to:', `${baseUrl}/api/auth/register/confirm/`);
  console.log('Request payload:', JSON.stringify(payload, null, 2));
  
  const res = await fetch(`${baseUrl}/api/auth/register/confirm/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  console.log('Response status:', res.status);
  console.log('Response headers:', res.headers);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('OTP confirmation failed. Response:', errorText);
    throw new Error(`OTP confirmation failed: ${res.status} - ${errorText}`);
  }
  
  const data = await res.json();
  console.log('OTP confirmation successful. Response:', data);
  
  // Persist baseUrl and tokens after successful confirmation
  setApiBaseUrl(baseUrl);
  if (data?.access || data?.refresh || data?.token) {
    saveTokens({ access: data.access, refresh: data.refresh, legacyToken: data.token });
  }
  return data;
}
