import React, { useState } from 'react';
import { VCStorageProvider } from './context/VCStorageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import StatusBar from './components/StatusBar.jsx';
import Statistics from './components/Statistics.jsx';
import TestInterface from './components/TestInterface.jsx';
import SyncControls from './components/SyncControls.jsx';
import StorageLogs from './components/StorageLogs.jsx';
import Login from './components/Login.jsx';
import SignIn from './SignIn';
import SignUp from './SignUp';
import OrgSignIn from './orgSignIn';
import './App.css';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState('orgSignIn'); // Start with organization sign-in

  if (!isAuthenticated) {
    // Handle different authentication pages
    switch (currentPage) {
      case 'orgSignUp':
        return (
          <SignUp 
            onSwitchToSignIn={() => setCurrentPage('orgSignIn')} 
          />
        );
      case 'workerSignIn':
        return (
          <SignIn 
            onSwitchToSignUp={() => setCurrentPage('orgSignUp')}
            onSwitchToOrgSignIn={() => setCurrentPage('orgSignIn')}
          />
        );
      case 'orgSignIn':
      default:
        return (
          <OrgSignIn 
            onSwitchToSignUp={() => setCurrentPage('orgSignUp')}
            onSwitchToWorkerSignIn={() => setCurrentPage('workerSignIn')}
          />
        );
    }
  }

  return (
    <div className="app-container">
      <VCStorageProvider>
        <div className="container">
          <div className="card">
            <h1>🔐 VC Storage & Sync System</h1>
            <StatusBar />
          </div>
          <Login />
          <Statistics />
          <TestInterface />
          <SyncControls />
          <StorageLogs />
        </div>
      </VCStorageProvider>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;