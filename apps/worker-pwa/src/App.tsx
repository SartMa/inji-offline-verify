// Using automatic JSX runtime
import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import VCStorageProvider from './context/VCStorageContext';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import CacheSyncProvider from './context/CacheSyncContext';
import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Settings/Settings';
import VPVerification from './pages/VPVerification';
import SignIn from './SignIn.tsx';
import './App.css';

// Root redirect component - redirects based on authentication status
function RootRedirect() {
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
  
  return <Navigate to={isAuthenticated ? "/dashboard" : "/signin"} replace />;
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
    return <Navigate to="/signin" replace />;
  }
  
  return <>{children}</>;
}

// Main app content with routing
function AppContent() {
  return (
    <Routes>
      {/* Root redirect based on authentication */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/signin" element={<SignIn />} />
      
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
      <Route 
        path="/vp-verification" 
        element={
          <ProtectedRoute>
            <VPVerification />
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
