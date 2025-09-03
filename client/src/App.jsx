import React from 'react';
import { VCStorageProvider } from './context/VCStorageContext';
import StatusBar from './components/StatusBar.jsx';
import Statistics from './components/Statistics.jsx';
import TestInterface from './components/TestInterface.jsx';
import SyncControls from './components/SyncControls.jsx';
import StorageLogs from './components/StorageLogs.jsx';
import Login from './components/Login.jsx';
import './App.css';

function App() {
  return (
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
  );
}

export default App;