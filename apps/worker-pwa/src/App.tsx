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
import { KeyCacheManager } from './cache/KeyCacheManager';
import { base58btc } from 'multiformats/bases/base58';

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
    setMessage('Processing VC and fetching public keys...');

    try {
      const parsedData = JSON.parse(vcData);
      const credential = parsedData.credential;
      
      if (!credential || !credential.issuer) {
        throw new Error('Invalid VC format: missing credential or issuer');
      }

      // Extract DID from issuer
      const issuerDid = credential.issuer;
      console.log('Processing VC with issuer DID:', issuerDid);

      // Extract verification method from proof if available
      const verificationMethod = credential.proof?.verificationMethod;
      const didToResolve = verificationMethod || issuerDid;
      
      console.log('Resolving DID:', didToResolve);

      // Use PublicKeyGetterFactory to fetch the public key
      const publicKeyGetterFactory = new PublicKeyGetterFactory();
      
      try {
        const publicKeyData = await publicKeyGetterFactory.get(didToResolve);
        console.log('Retrieved public key data:', publicKeyData);

        // Send to Django backend for persistent storage
        try {
          let accessToken = getAccessToken();
          const legacyToken = localStorage.getItem('auth.legacyToken'); // Try legacy token too
          const apiBaseUrl = getApiBaseUrl();
          
          console.log('Debug: initial accessToken exists:', !!accessToken);
          console.log('Debug: legacyToken exists:', !!legacyToken);
          console.log('Debug: apiBaseUrl:', apiBaseUrl);
          
          // Helper function to make the API call
          const makeApiCall = async (token: string, isJWT: boolean) => {
            const authHeader = isJWT ? `Bearer ${token}` : `Token ${token}`;
            const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/org/public-keys/` : '/api/org/public-keys/';
            
            console.log('Debug: Making request to:', apiUrl);
            console.log('Debug: Auth header type:', isJWT ? 'JWT Bearer' : 'Legacy Token');
            
            return fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
              },
              body: JSON.stringify({
                did: didToResolve,
                verification_method: publicKeyData.verificationMethod,
                key_type: publicKeyData.keyType,
                algorithm: publicKeyData.algorithm,
                public_key_jwk: publicKeyData.jwk,
                public_key_pem: publicKeyData.pem,
                public_key_bytes: publicKeyData.bytes ? Array.from(publicKeyData.bytes) : null,
                issuer_did: issuerDid,
                credential_id: credential.id || null
              })
            });
          };
          
          let response: Response | null = null;
          
          // Try with access token first
          if (accessToken) {
            response = await makeApiCall(accessToken, true);
            
            // If token is expired, try to refresh it
            if (response.status === 401) {
              console.log('Access token expired, attempting refresh...');
              const newAccessToken = await refreshAccessToken();
              if (newAccessToken) {
                console.log('Token refreshed successfully');
                accessToken = newAccessToken;
                response = await makeApiCall(accessToken, true);
              } else {
                console.log('Token refresh failed, trying legacy token...');
                if (legacyToken) {
                  response = await makeApiCall(legacyToken, false);
                }
              }
            }
          } else if (legacyToken) {
            // No access token, try legacy token
            response = await makeApiCall(legacyToken, false);
          }
          
          if (!response) {
            throw new Error('No valid authentication token available');
          }

          if (response.ok) {
            const result = await response.json();
            console.log('Stored in Django database:', result);
            
            // Also cache locally in IndexedDB for offline use
            try {
              // Generate proper multibase format for Ed25519 keys
            let publicKeyMultibase: string | undefined;
            if (publicKeyData.bytes && publicKeyData.algorithm === 'Ed25519') {
              const raw = spkiToRawEd25519(publicKeyData.bytes);
              publicKeyMultibase = ed25519RawToMultibase(raw); // will look like z6M...
            }
            // ...
            await KeyCacheManager.putKeys([{
              key_id: didToResolve,
              key_type: publicKeyData.keyType,
              public_key_multibase: publicKeyMultibase,
              public_key_hex: publicKeyData.bytes
                ? Array.from(publicKeyData.bytes).map(b => b.toString(16).padStart(2, '0')).join('')
                : undefined,
              public_key_jwk: publicKeyData.jwk,
              controller: didToResolve.split('#')[0], // remove fragment
              purpose: 'assertion',
              is_active: true,
              organization_id: null,
            }]);
              console.log('Cached public key in IndexedDB with proper multibase encoding');
              
              setMessage(`✅ Success! Public key fetched, stored in database, and cached locally.\n\nDID: ${didToResolve}\nKey Type: ${publicKeyData.keyType}\nAlgorithm: ${publicKeyData.algorithm}\n\nCache: ✅ IndexedDB\nDatabase: ✅ Django`);
            } catch (cacheError) {
              console.warn('Failed to cache locally:', cacheError);
              setMessage(`✅ Success! Public key fetched and stored in database.\n⚠️ Local caching failed but database storage succeeded.\n\nDID: ${didToResolve}\nKey Type: ${publicKeyData.keyType}\nAlgorithm: ${publicKeyData.algorithm}`);
            }
          } else {
            // Log the full response for debugging
            const responseText = await response.text();
            console.error('Django storage failed:', {
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              body: responseText
            });
            
            let errorMessage = 'Unknown error';
            try {
              const errorData = JSON.parse(responseText);
              errorMessage = errorData.error || errorData.detail || 'Unknown error';
            } catch {
              errorMessage = responseText || `HTTP ${response.status}`;
            }
            
            setMessage(`⚠️ Public key fetched but failed to store in database (${response.status}): ${errorMessage}\n\nDID: ${didToResolve}\nKey Type: ${publicKeyData.keyType}`);
          }
        } catch (apiError) {
          console.error('API call failed:', apiError);
          setMessage(`⚠️ Public key fetched but network error prevented database storage.\n\nDID: ${didToResolve}\nKey Type: ${publicKeyData.keyType}\nError: ${apiError instanceof Error ? apiError.message : 'Network error'}`);
        }

      } catch (keyError) {
        console.error('Failed to fetch public key:', keyError);
        setMessage(`❌ Failed to fetch public key for DID: ${didToResolve}\nError: ${keyError instanceof Error ? keyError.message : 'Unknown error'}`);
      }

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
//     "id": "did:rcw:ab01ec3f-9f67-4ce8-ade1-8fce82a9bee1",
//     "type": [
//         "VerifiableCredential",
//         "LifeInsuranceCredential",
//         "InsuranceCredential"
//     ],
//     "proof": {
//         "type": "Ed25519Signature2020",
//         "created": "2024-05-03T12:53:39Z",
//         "proofValue": "z4GVSorSVms65uTSLHRdqJB7Km7UuyzGzYbu9uKuwBPRLgHLmBMa8YnBczVh4id2PMsrB31kjCbe6NVLdA9jThURs",
//         "proofPurpose": "assertionMethod",
//         "verificationMethod": "did:web:challabeehyv.github.io:DID-Resolve:3313e611-d08a-49c8-b478-7f55eafe62f2#key-0"
//     },
//     "issuer": "did:web:challabeehyv.github.io:DID-Resolve:3313e611-d08a-49c8-b478-7f55eafe62f2",
//     "@context": [
//         "https://www.w3.org/2018/credentials/v1",
//         "https://holashchand.github.io/test_project/insurance-context.json",
//         {
//             "LifeInsuranceCredential": {
//                 "@id": "InsuranceCredential"
//             }
//         },
//         "https://w3id.org/security/suites/ed25519-2020/v1"
//     ],
//     "issuanceDate": "2024-05-03T12:53:39.113Z",
//     "expirationDate": "2024-06-02T12:53:39.110Z",
//     "credentialSubject": {
//         "id": "did:jwk:eyJrdHkiOiJFQyIsInVzZSI6InNpZyIsImNydiI6IlAtMjU2Iiwia2lkIjoic3pGa2cyOVFFalpiQ1VheFRfbFdiZElEU1ZQNWhlREhTeGR6UlhTOW1WZyIsIngiOiJzeV2Y2pEX1k0Y0xFS2NUTGR3a1dEWnR1RGpGWGxwcUtLZ2l5TDB2ZUY0IiwieSI6Ii13eGZIMDZRclRCZGljOG1yRDRBM2E0alhGREx1RnlBa0NPMm56Z3BNUGMiLCJhbGciOiJFUzI1NiJ9",
//         "dob": "1991-08-13",
//         "email": "challarao@beehyv.com",
//         "gender": "Male",
//         "mobile": "0123456789",
//         "benefits": [
//             "Critical Surgery",
//             "Full body checkup"
//         ],
//         "fullName": "Challarao V",
//         "policyName": "Start Insurance Gold Premium",
//         "policyNumber": "1234567",
//         "policyIssuedOn": "2023-04-20T20:48:17.684Z",
//         "policyExpiresOn": "2033-04-20T20:48:17.684Z"
//     }
// };
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

export function spkiToRawEd25519(spki: Uint8Array): Uint8Array {
  // If already 32-byte raw key, return as-is
  if (spki.length === 32) return new Uint8Array(spki);

  // Read DER length (short/long form)
  const readLen = (buf: Uint8Array, at: number) => {
    let len = buf[at];
    let lenBytes = 1;
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let j = 1; j <= n; j++) len = (len << 8) | buf[at + j];
      lenBytes = 1 + n;
    }
    return { len, lenBytes };
  };

  // Scan for the real BIT STRING tag (0x03) with 0x00 pad and 32 bytes
  for (let i = 0; i < spki.length; i++) {
    if (spki[i] !== 0x03) continue; // BIT STRING tag
    const { len, lenBytes } = readLen(spki, i + 1);
    const pad = spki[i + 1 + lenBytes];
    const contentStart = i + 1 + lenBytes + 1; // skip pad
    const contentLen = len - 1; // exclude pad byte
    if (pad === 0x00 && contentLen >= 32 && contentStart + 32 <= spki.length) {
      // For Ed25519 SPKI, the public key is exactly 32 bytes
      return new Uint8Array(spki.subarray(contentStart, contentStart + 32));
    }
  }

  throw new Error('SPKI parse error: BIT STRING with 32-byte Ed25519 key not found');
}

export function ed25519RawToMultibase(raw32: Uint8Array): string {
  const header = new Uint8Array([0xed, 0x01]); // ed25519-pub multicodec
  const out = new Uint8Array(header.length + raw32.length);
  out.set(header, 0);
  out.set(raw32, header.length);
  return base58btc.encode(out);
}
