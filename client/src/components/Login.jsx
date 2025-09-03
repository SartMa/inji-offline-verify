import React, { useState } from 'react';
import { login, registerOrganization, setApiBaseUrl } from '../services/authService';

export default function Login() {
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:8000');
  const [orgName, setOrgName] = useState('Acme Corp');
  const [username, setUsername] = useState('worker1');
  const [password, setPassword] = useState('W0rkerP@ss!');
  const [output, setOutput] = useState('');

  const doLogin = async (e) => {
    e.preventDefault();
    try {
      setApiBaseUrl(baseUrl);
      const res = await login(baseUrl, { username, password, org_name: orgName });
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
          <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Acme Corp" />
        </label>
        <label>
          Username
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="worker1" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••" />
        </label>
        <button type="submit">Login</button>
      </form>
      <pre style={{ background: '#f8f8f8', padding: 8, marginTop: 12, maxHeight: 200, overflow: 'auto' }}>{output}</pre>
    </div>
  );
}
