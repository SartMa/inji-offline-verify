// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import React from 'react';
import { Route, Routes, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@inji-offline-verify/shared-auth';
import Dashboard from "../pages/Dashboard";
import AddWorker from "../pages/AddWorker/AddWorker";
import AddDID from "../pages/AddDID";
import AddRevokedVC from "../pages/AddRevokedVC";
import VerificationLogsPage from "../pages/VerificationLogsPage";
import MyAccount from "../pages/MyAccount/MyAccount";
import OrgSignIn from "../pages/SignInPage/orgSignIn";
import SignUp from "../pages/SignUpPage/SignUp";
import OrganizationResetPassword from "../pages/ResetPassword";

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
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

// Public route wrapper - redirects to dashboard if authenticated
function PublicRoute({ children }: { children: React.ReactNode }) {
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
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Root redirect component
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

export function App() {
  return (
    <div>
      <Routes>
        {/* Root route - redirect based on auth status */}
        <Route path="/" element={<RootRedirect />} />
        
        {/* Public routes - redirect to dashboard if authenticated */}
        <Route 
          path="/signin" 
          element={
            <PublicRoute>
              <OrgSignIn />
            </PublicRoute>
          } 
        />
        <Route 
          path="/signup" 
          element={
            <PublicRoute>
              <SignUp />
            </PublicRoute>
          } 
        />
        <Route path="/reset-password" element={<OrganizationResetPassword />} />
        
        {/* Protected routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/add-worker" 
          element={
            <ProtectedRoute>
              <AddWorker />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/add-did" 
          element={
            <ProtectedRoute>
              <AddDID />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/add-revoked-vc" 
          element={
            <ProtectedRoute>
              <AddRevokedVC />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/logs" 
          element={
            <ProtectedRoute>
              <VerificationLogsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/logs/:userId" 
          element={
            <ProtectedRoute>
              <VerificationLogsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/my-account" 
          element={
            <ProtectedRoute>
              <MyAccount />
            </ProtectedRoute>
          } 
        />
        
        {/* Redirect all unknown routes to root (which will handle auth redirect) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;


