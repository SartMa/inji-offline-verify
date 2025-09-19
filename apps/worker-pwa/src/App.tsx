import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import VCStorageProvider from './context/VCStorageContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import StatusBar from './components/StatusBar.jsx';
import Statistics from './components/Statistics.jsx';
import TestInterface from './components/TestInterface.jsx';
import SyncControls from './components/SyncControls.jsx';
import StorageLogs from './components/StorageLogs.jsx';
import SignIn from './SignIn.tsx';
// Import directly from SDK source since it has build issues
import QRCodeVerification from '../../../packages/inji-verify-sdk/src/components/qrcode-verification/QRCodeVerification';
import { VerificationResult } from '../../../packages/inji-verify-sdk/src/services/offline-verifier/data/data';
import { CredentialFormat } from '../../../packages/inji-verify-sdk/src/services/offline-verifier/constants/CredentialFormat';
import { PublicKeyGetterFactory } from '../../../packages/inji-verify-sdk/src/services/offline-verifier/publicKey/PublicKeyGetterFactory';
// import { MultibaseUtils } from '../../../packages/inji-verify-sdk/src/services/offline-verifier/utils/MultibaseUtils';
import { getAccessToken, getApiBaseUrl, refreshAccessToken } from '@inji-offline-verify/shared-auth';
import { OrgResolver } from '../../../packages/inji-verify-sdk/src/services/offline-verifier/cache/utils/OrgResolver';
import { SDKCacheManager } from '../../../packages/inji-verify-sdk/src/services/offline-verifier/cache/SDKCacheManager';

import './App.css';

// Landing page component
function LandingPage() {
  const navigate = useNavigate();
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      gap: '20px',
      backgroundColor: '#f5f5f5'
    }}>
      <h1 style={{ color: '#333', marginBottom: '30px' }}>Worker VC Verification System</h1>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button 
          onClick={() => navigate('/worker-signin')}
          style={{ 
            padding: '12px 24px', 
            fontSize: '16px', 
            borderRadius: '8px',
            border: '1px solid #ddd',
            backgroundColor: '#ed6c02',
            color: 'white', 
            cursor: 'pointer',
            transition: 'background-color 0.3s'
          }}
        >
          Worker Sign In
        </button>
      </div>
    </div>
  );
}

// QR Test component for the dashboard
function QRTestSection() {
  const handleVerificationResult = (result: VerificationResult) => {
    if (result.verificationStatus) {
      alert(`✅ Credential is valid!\nMessage: ${result.verificationMessage}`);
    } else {
      alert(`❌ Credential verification failed\nError: ${result.verificationMessage}\nError Code: ${result.verificationErrorCode}`);
    }
  };

  const handleError = (error: Error) => {
    alert(`QR scanning error: ${error.message}`);
  };

  return (
    <div style={{ 
      border: '2px dashed #ccc', 
      borderRadius: '8px', 
      padding: '20px',
      backgroundColor: 'white',
      marginBottom: '20px'
    }}>
      <h3 style={{ color: '#333', marginBottom: '15px' }}>QR Code Verification</h3>
      
      <QRCodeVerification
        mode="offline"
        onVerificationResult={handleVerificationResult}
        onError={handleError}
        credentialFormat={CredentialFormat.LDP_VC}
        triggerElement={
          <button style={{
            padding: '10px 20px',
            fontSize: '14px',
            borderRadius: '6px',
            border: '2px solid #1976d2',
            backgroundColor: '#1976d2',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}>
            📷 Start QR Scan
          </button>
        }
        isEnableUpload={true}
        isEnableScan={true}
        isEnableZoom={true}
      />
      
      <p style={{ marginTop: '15px', color: '#666', fontSize: '12px' }}>
        Click the button above to scan QR codes for offline verification
      </p>
    </div>
  );
}

// Helper to convert hex string to byte array (for Django API public_key_bytes)
function hexToBytes(hex?: string): number[] | undefined {
  if (!hex) return undefined;
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) return undefined;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    out.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

// VC Upload component for caching public keys
function VCUploadSection() {
  const [vcData, setVcData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUploadVC = async () => {
    if (!vcData.trim()) {
      setMessage('Please enter VC data');
      return;
    }

    setIsLoading(true);
    setMessage('Processing VC, storing to server, and priming offline cache...');

    try {
      const parsed = JSON.parse(vcData);

      // Build a CacheBundle using SDK OrgResolver
      const bundle = await OrgResolver.buildBundleFromVC(parsed, true);
      const base = getApiBaseUrl();
      const token = getAccessToken();
      if (!base || !token) throw new Error('Not authenticated. Please sign in first.');

      // 1) Store contexts in Django (admin-only endpoint)
      for (const c of bundle.contexts || []) {
        await fetch(`${base}/api/contexts/upsert/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: c.url, document: c.document })
        });
      }

      // 2) Store public keys in Django (map to expected fields)
      for (const k of bundle.publicKeys || []) {
        const payload = {
          did: k.controller,                                // required
          verification_method: k.key_id,                    // used as key_id server-side
          key_type: k.key_type || 'Ed25519VerificationKey2020',
          algorithm: (k.key_type || '').includes('Ed25519') ? 'Ed25519' : undefined,
          public_key_jwk: k.public_key_jwk || undefined,    // optional
          public_key_bytes: hexToBytes(k.public_key_hex),    // optional; server converts to hex
          issuer_did: k.controller,                          // optional metadata
          credential_id: undefined                           // add if you have one
        };
        const res = await fetch(`${base}/api/org/public-keys/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(j?.error || j?.detail || 'Failed to store public key on server');
        }
      }

      // 3) Immediately prime the SDK offline cache locally (no app-side cache logic)
      await SDKCacheManager.primeFromServer({
        publicKeys: (bundle.publicKeys || []).map(k => ({
          key_id: k.key_id,
          key_type: k.key_type,
          public_key_multibase: k.public_key_multibase,
          public_key_hex: k.public_key_hex,
          public_key_jwk: k.public_key_jwk,
          controller: k.controller,
          purpose: k.purpose,
          is_active: k.is_active,
          organization_id: k.organization_id
        })),
        contexts: bundle.contexts || [],
        contextUrls: bundle.contextUrls || []
      });

      setMessage(`✅ Stored on server and cached locally for offline verification.\nKeys: ${(bundle.publicKeys || []).length}\nContexts: ${(bundle.contexts || []).length}`);
      setVcData('');
    } catch (error) {
      console.error('Error processing VC:', error);
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleVC = {
    "credential": {
        "id": "did:cbse:327b6c3f-ce17-4c00-ae4f-7fb2313b0626",
        "type": [
            "VerifiableCredential",
            "UniversityDegreeCredential"
        ],
        "proof": {
            "type": "Ed25519Signature2020",
            "created": "2024-05-16T07:27:43Z",
            "proofValue": "z56crqnnjmvDa46FqmAnVhEttqKtFMTQ1et1mM5dA3WSHtb5ncQ36sS8fG3fxw6dpvtqbqvaE5FzaqwJTBX6dGH3P",
            "proofPurpose": "assertionMethod",
            "verificationMethod": "did:web:Sreejit-K.github.io:VCTest:d40bdb68-6a8d-4b71-9c2a-f3002513ae0e#key-0"
        },
        "issuer": "did:web:Sreejit-K.github.io:VCTest:d40bdb68-6a8d-4b71-9c2a-f3002513ae0e",
        "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://sreejit-k.github.io/VCTest/udc-context2.json",
            "https://w3id.org/security/suites/ed25519-2020/v1"
        ],
        "issuanceDate": "2023-02-06T11:56:27.259Z",
        "expirationDate": "2025-02-08T11:56:27.259Z",
        "credentialSubject": {
            "id": "did:example:2002-AR-015678",
            "type": "UniversityDegreeCredential",
            "ChildFullName": "Alex Jameson Taylor",
            "ChildDob": "January 15, 2002",
            "ChildGender": "Male",
            "ChildNationality": "Arandian",
            "ChildPlaceOfBirth": "Central Hospital, New Valera, Arandia",
            "FatherFullName": "Michael David Taylor",
            "FatherDob": "April 22, 1988",
            "FatherNationality": "Arandian",
            "MotherFullName": "Emma Louise Taylor",
            "MotherDob": "June 5, 1990",
            "MotherNationality": "Arandian",
            "RegistrationNumber": "2002-AR-015678",
            "DateOfRegistration": "January 20, 2002",
            "DateOfIssuance": "January 22, 2002"
        }
    },
    "credentialSchemaId": "did:schema:e2e6b5b7-8af7-4018-a472-3f1e396c3c1e",
    "createdAt": "2024-05-16T07:27:43.831Z",
    "updatedAt": "2024-05-16T07:27:43.831Z",
    "createdBy": "",
    "updatedBy": "",
    "tags": [
        "tag1",
        "tag2",
        "tag3"
    ]
  };


//   const sampleVC = {
//     "id": "did:cbse:327b6c3f-ce17-4c00-ae4f-7fb2313b0626",
//     "type": [
//         "VerifiableCredential",
//         "UniversityDegreeCredential"
//     ],
//     "proof": {
//         "type": "Ed25519Signature2020",
//         "created": "2024-05-16T07:27:43Z",
//         "proofValue": "z56crqnnjmvDa46FqmAnVhEttqKtFMTQ1et1mM5dA3WSHtb5ncQ36sS8fG3fxw6dpvtqbqvaE5FzaqwJTBX6dGH3P",
//         "proofPurpose": "assertionMethod",
//         "verificationMethod": "did:web:Sreejit-K.github.io:VCTest:d40bdb68-6a8d-4b71-9c2a-f3002513ae0e#key-0"
//     },
//     "issuer": "did:web:Sreejit-K.github.io:VCTest:d40bdb68-6a8d-4b71-9c2a-f3002513ae0e",
//     "@context": [
//         "https://www.w3.org/2018/credentials/v1",
//         "https://sreejit-k.github.io/VCTest/udc-context2.json",
//         "https://w3id.org/security/suites/ed25519-2020/v1"
//     ],
//     "issuanceDate": "2023-02-06T11:56:27.259Z",
//     "expirationDate": "2025-02-08T11:56:27.259Z",
//     "credentialSubject": {
//         "id": "did:example:2002-AR-015678",
//         "type": "UniversityDegreeCredential",
//         "ChildFullName": "Alex Jameson Taylor",
//         "ChildDob": "January 15, 2003",
//         "ChildGender": "Male",
//         "ChildNationality": "Arandian",
//         "ChildPlaceOfBirth": "Central Hospital, New Valera, Arandia",
//         "FatherFullName": "Michael David Taylor",
//         "FatherDob": "April 22, 1988",
//         "FatherNationality": "Arandian",
//         "MotherFullName": "Emma Louise Taylor",
//         "MotherDob": "June 5, 1990",
//         "MotherNationality": "Arandian",
//         "RegistrationNumber": "2002-AR-015678",
//         "DateOfRegistration": "January 20, 2002",
//         "DateOfIssuance": "January 22, 2002"
//     }
// }
  return (
    <div style={{ 
      border: '2px dashed #ccc', 
      borderRadius: '8px', 
      padding: '20px',
      backgroundColor: 'white',
      marginBottom: '20px'
    }}>
      <h3 style={{ color: '#333', marginBottom: '15px' }}>VC Data Upload & Public Key Caching</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <textarea
          value={vcData}
          onChange={(e) => setVcData(e.target.value)}
          placeholder="Paste your VC JSON data here..."
          style={{
            width: '100%',
            height: '200px',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button
          onClick={handleUploadVC}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: isLoading ? '#ccc' : '#2e7d32',
            color: 'white',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s'
          }}
        >
          {isLoading ? 'Processing...' : '📤 Process VC & Cache Keys'}
        </button>

        <button
          onClick={() => setVcData(JSON.stringify(sampleVC, null, 2))}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            borderRadius: '6px',
            border: '1px solid #1976d2',
            backgroundColor: 'white',
            color: '#1976d2',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          � Load Sample VC
        </button>
      </div>

      {message && (
        <div style={{
          padding: '10px',
          borderRadius: '4px',
          backgroundColor: message.startsWith('✅') ? '#e8f5e8' : '#ffeaea',
          color: message.startsWith('✅') ? '#2e7d32' : '#d32f2f',
          fontSize: '14px'
        }}>
          {message}
        </div>
      )}
      
      <p style={{ marginTop: '15px', color: '#666', fontSize: '12px' }}>
        Upload VC data to extract and cache public keys for offline verification
      </p>
    </div>
  );
}

function WorkerSignInPage() {
  const navigate = useNavigate();
  return (
    <SignIn 
      onSwitchToSignUp={() => navigate('/')}
      onSwitchToOrgSignIn={() => navigate('/')}
    />
  );
}

// Main dashboard component
function Dashboard() {
  const { signOut, user } = useAuth();
  
  const handleSignOut = () => {
    signOut();
    // Navigate to home page after sign out
    window.location.href = '/';
  };
  
  return (
    <div className="App">
      <VCStorageProvider>
        {/* Add header with logout */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '10px 20px', 
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid #ddd'
        }}>
          <h2 style={{ margin: 0 }}>VC Verification Dashboard</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span>Welcome, {user?.email || 'User'}</span>
            <button 
              onClick={handleSignOut}
              style={{
                padding: '8px 16px',
                backgroundColor: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
        
        <StatusBar />
        
        <div style={{ padding: '20px' }}>
          {/* QR Test and VC Upload Sections */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', 
            gap: '20px',
            marginBottom: '20px'
          }}>
            <QRTestSection />
            <VCUploadSection />
          </div>
          
          {/* Original Dashboard Content */}
          <div className="main-content">
            <div className="left-panel">
              <Statistics />
              <TestInterface />
              <SyncControls />
            </div>
            <div className="right-panel">
              <StorageLogs />
            </div>
          </div>
        </div>
      </VCStorageProvider>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/worker-signin" replace />;
  }
  
  return <>{children}</>;
}

// Main app content with routing
function AppContent() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/worker-signin" element={<WorkerSignInPage />} />
      
      {/* Protected routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Redirect unknown routes to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Main App component
function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
