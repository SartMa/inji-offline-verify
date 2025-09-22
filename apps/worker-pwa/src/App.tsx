// Using automatic JSX runtime
import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import VCStorageProvider from './context/VCStorageContext';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import CacheSyncProvider from './context/CacheSyncContext';
import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Settings/Settings';
import SignIn from './SignIn.tsx';
import './App.css';

// Landing page component - only for workers
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
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <p style={{ color: '#666' }}>
          Are you an organization admin? 
          <br />
          Please use the Organization Portal instead.
        </p>
      </div>
    </div>
  );
}

// Worker sign in page
function WorkerSignInPage() {
  const navigate = useNavigate();
  return (
    <SignIn 
      onSwitchToOrgSignIn={() => navigate('/')}
    />
  );
}

// Dashboard wrapper component with VCStorageProvider
function WorkerDashboard() {
  return (
    <VCStorageProvider>
      <Dashboard />
    </VCStorageProvider>
  );
}

// Settings wrapper component with VCStorageProvider
function WorkerSettings() {
  return (
    <VCStorageProvider>
      <Settings />
    </VCStorageProvider>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
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
            <WorkerDashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute>
            <WorkerSettings />
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
        <CacheSyncProvider>
          <VCStorageProvider>
            <AppContent />
          </VCStorageProvider>
        </CacheSyncProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
