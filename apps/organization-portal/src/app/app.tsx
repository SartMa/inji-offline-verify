// Uncomment this line to use CSS modules
// import styles from './app.module.css';
import React from 'react';
import { Route, Routes, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@inji-offline-verify/shared-auth';
import Dashboard from "../pages/Dashboard";
import AddWorker from "../pages/AddWorker/AddWorker";
import AddDID from "../pages/AddDID";
import VerificationLogsPage from "../pages/VerificationLogsPage";
import OrgSignIn from "../pages/SignInPage/orgSignIn";
import SignUp from "../pages/SignUpPage/SignUp";

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

// Landing page component
function LandingPage() {
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
      <h1 style={{ color: '#333', marginBottom: '30px' }}>Organization Portal</h1>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/signin">
          <button style={{ 
            padding: '12px 24px', 
            fontSize: '16px', 
            borderRadius: '8px', 
            border: '1px solid #ddd',
            backgroundColor: '#1976d2',
            color: 'white',
            cursor: 'pointer',
            textDecoration: 'none'
          }}>
            Organization Sign In
          </button>
        </Link>
        <Link to="/signup">
          <button style={{ 
            padding: '12px 24px', 
            fontSize: '16px', 
            borderRadius: '8px',
            border: '1px solid #ddd',
            backgroundColor: '#2e7d32',
            color: 'white', 
            cursor: 'pointer',
            textDecoration: 'none'
          }}>
            Register New Organization
          </button>
        </Link>
      </div>
    </div>
  );
}

// Sign-in wrapper component
function SignInPage() {
  return <OrgSignIn />;
}

// Sign-up wrapper component  
function SignUpPage() {
  return <SignUp />;
}

export function App() {
  return (
    <div>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        
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
        
        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;


