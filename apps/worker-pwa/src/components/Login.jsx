import React, { useState } from 'react';
import { login, registerOrganization, setApiBaseUrl } from '../services/authService';
import { PublicKeyService } from '../services/PublicKeyService';
import { ContextService } from '../services/ContextService';
import { ContextCache } from '../cache/KeyCacheManager';
import { KeyCacheManager } from '../cache/KeyCacheManager';

export default function Login() {
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:8000');
  const [orgName, setOrgName] = useState('Acme Corp1');
  const [username, setUsername] = useState('sunsun');
  const [password, setPassword] = useState('sunhith123');
  const [output, setOutput] = useState('');
  const [cachedKeys, setCachedKeys] = useState([]);
  const [cachedCount, setCachedCount] = useState(0);
  const [contexts, setContexts] = useState([]);

  const doLogin = async (e) => {
    e.preventDefault();
    try {
      setApiBaseUrl(baseUrl);
      const res = await login(baseUrl, { username, password, org_name: orgName });
      // Fetch and cache active public keys for this org after login
      // Also fetch and cache required JSON-LD contexts for offline usage
        try {
          const isStaff = !!res?.is_staff;
          const count = isStaff
            ? await ContextService.refreshOnServerAndCache()
            : await ContextService.fetchAndCacheDefaults();
          console.log(`Contexts cached: ${count}`);
          const list = await ContextCache.listContexts();
          setContexts(list || []);
        } catch (e) {
          console.warn('Context fetch/cache failed:', e);
        }
      const orgId = res?.organization?.id;
      if (orgId) {
        try {
          await PublicKeyService.fetchAndCacheKeys({ organization_id: orgId });
          const keys = await KeyCacheManager.getKeysByOrg(orgId);
          setCachedKeys(keys || []);
          setCachedCount((keys || []).length);
        } catch (e) {
          console.warn('Key fetch/cache failed:', e);
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

      <div style={{ marginTop: 16 }}>
        <h3>Cached Public Keys (IndexedDB)</h3>
        <div>Count: {cachedCount}</div>
        <div style={{ maxHeight: 200, overflow: 'auto', background: '#fafafa', padding: 8, border: '1px solid #eee' }}>
          {cachedKeys && cachedKeys.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {cachedKeys.map(k => (
                <li key={k.key_id}>
                  <div><strong>key_id:</strong> {k.key_id}</div>
                  <div><strong>controller:</strong> {k.controller}</div>
                  <div><strong>type:</strong> {k.key_type}</div>
                  <div><strong>active:</strong> {String(k.is_active)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <em>No keys cached yet</em>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Cached JSON-LD Contexts (IndexedDB)</h3>
        <div>Count: {Array.isArray(contexts) ? contexts.length : 0}</div>
        <div style={{ maxHeight: 200, overflow: 'auto', background: '#fafafa', padding: 8, border: '1px solid #eee' }}>
          {Array.isArray(contexts) && contexts.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {contexts.map(c => (
                <li key={c.url}>
                  <div><strong>url:</strong> {c.url}</div>
                  <div><strong>cachedAt:</strong> {new Date(c.cachedAt).toLocaleString?.() || c.cachedAt}</div>
                  <div><strong>source:</strong> {c.source}</div>
                </li>
              ))}
            </ul>
          ) : (
            <em>No contexts cached yet</em>
          )}
        </div>
      </div>
    </div>
  );
}
