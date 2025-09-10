import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import VCStorageProvider from './context/VCStorageContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import StatusBar from './components/StatusBar.jsx';
import Statistics from './components/Statistics.jsx';
import TestInterface from './components/TestInterface.jsx';
import SyncControls from './components/SyncControls.jsx';
import StorageLogs from './components/StorageLogs.jsx';
import SignIn from './SignIn.tsx';
import SignUp from './SignUp.tsx';
import OrgSignIn from './orgSignIn.tsx';
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
      <h1 style={{ color: '#333', marginBottom: '30px' }}>VC Verification System</h1>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button 
          onClick={() => navigate('/org-signin')}
          style={{ 
            padding: '12px 24px', 
            fontSize: '16px', 
            borderRadius: '8px', 
            border: '1px solid #ddd',
            backgroundColor: '#1976d2',
            color: 'white',
            cursor: 'pointer',
            transition: 'background-color 0.3s'
          }}
        >
          Organization Admin Sign In
        </button>
        <button 
          onClick={() => navigate('/org-signup')}
          style={{ 
            padding: '12px 24px', 
            fontSize: '16px', 
            borderRadius: '8px',
            border: '1px solid #ddd',
            backgroundColor: '#2e7d32',
            color: 'white', 
            cursor: 'pointer',
            transition: 'background-color 0.3s'
          }}
        >
          Register New Organization
        </button>
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

// Auth wrapper components for each route
function OrgSignInPage() {
  const navigate = useNavigate();
  return (
    <OrgSignIn 
      onSwitchToSignUp={() => navigate('/org-signup')}
      onSwitchToWorkerSignIn={() => navigate('/worker-signin')}
    />
  );
}

function OrgSignUpPage() {
  const navigate = useNavigate();
  return (
    <SignUp 
      onSwitchToSignIn={() => navigate('/org-signin')}
      onSwitchToOrgSignIn={() => navigate('/org-signin')}
    />
  );
}

function WorkerSignInPage() {
  const navigate = useNavigate();
  return (
    <SignIn 
      onSwitchToSignUp={() => navigate('/org-signup')}
      onSwitchToOrgSignIn={() => navigate('/org-signin')}
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
    return <Navigate to="/org-signin" replace />;
  }
  
  return <>{children}</>;
}

// Main app content with routing
function AppContent() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/org-signin" element={<OrgSignInPage />} />
      <Route path="/org-signup" element={<OrgSignUpPage />} />
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
