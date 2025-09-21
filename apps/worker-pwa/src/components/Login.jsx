import React, { useState } from 'react';
import { login, registerOrganization, setApiBaseUrl } from '../services/authService';
import { WorkerCacheService } from '../services/WorkerCacheService';
import { NetworkManager } from '../network/NetworkManager';

export default function Login() {
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:8000');
  const [orgName, setOrgName] = useState('Acme Corp1');
  const [username, setUsername] = useState('sunsun');
  const [password, setPassword] = useState('sunhith123');
  const [output, setOutput] = useState('');
  // SDK cache managed internally; no local cache listing here

  const doLogin = async (e) => {
    e.preventDefault();
    try {
      setApiBaseUrl(baseUrl);
      const res = await login(baseUrl, { username, password, org_name: orgName });
      // Prime SDK cache from server responses (org-scoped contexts and public keys)
      const orgId = res?.organization?.id;
      if (orgId) {
        try {
          const bundle = await buildServerCacheBundle(orgId);
          await WorkerCacheService.primeFromServer(bundle);
          console.log('SDK cache primed for organization:', orgId);
        } catch (e) {
          console.warn('Priming SDK cache failed:', e);
        }
      }
      setOutput(JSON.stringify(res, null, 2));
    } catch (err) {
      setOutput(`Login failed: ${err.message}`);
    }
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8, marginBottom: 16 }}>
      <h2>Minimal Login</h2>
      <form onSubmit={doLogin} style={{ display: 'grid', gap: 8 }}>
        <label>
          Base URL
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:8000" />
        </label>
        <label>
          Organization
          <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Acme Corp1" />
        </label>
        <label>
          Username
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="sunsun" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••" />
        </label>
        <button type="submit">Login</button>
      </form>
      <pre style={{ background: '#f8f8f8', padding: 8, marginTop: 12, maxHeight: 200, overflow: 'auto' }}>{output}</pre>

      {/* SDK-managed cache, no local listing UI here to avoid duplication */}
    </div>
  );
}

// Build a CacheBundle for SDK from backend endpoints
async function buildServerCacheBundle(organizationId) {
  // Fetch contexts
  const ctxRes = await NetworkManager.fetch(`/organization/api/contexts/?organization_id=${encodeURIComponent(organizationId)}`, { method: 'GET' });
  if (!ctxRes.ok) throw new Error(`Failed to fetch contexts (${ctxRes.status})`);
  const ctxJson = await ctxRes.json();
  const contexts = Array.isArray(ctxJson?.contexts)
    ? ctxJson.contexts.map((c) => ({ url: c.url, document: c.document }))
    : [];

  // Fetch public keys
  const pkRes = await NetworkManager.fetch(`/organization/api/public-keys/?organization_id=${encodeURIComponent(organizationId)}`, { method: 'GET' });
  if (!pkRes.ok) throw new Error(`Failed to fetch public keys (${pkRes.status})`);
  const pkJson = await pkRes.json();
  const publicKeys = Array.isArray(pkJson?.keys)
    ? pkJson.keys.map((k) => ({
        key_id: k.key_id,
        key_type: k.key_type,
        public_key_multibase: k.public_key_multibase,
        public_key_hex: k.public_key_hex,
        public_key_jwk: k.public_key_jwk,
        controller: k.controller,
        purpose: k.purpose,
        is_active: k.is_active,
        organization_id: organizationId,
      }))
    : [];

  return { publicKeys, contexts };
}
