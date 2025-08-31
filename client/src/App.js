import React from 'react';
import { VCStorageProvider } from './context/VCStorageContext';
import StatusBar from './components/StatusBar';
import Statistics from './components/Statistics';
import TestInterface from './components/TestInterface';
import SyncControls from './components/SyncControls';
import StorageLogs from './components/StorageLogs';
import './App.css';

function App() {
  return (
    <VCStorageProvider>
      <div className="container">
        <div className="card">
          <h1>🔐 VC Storage & Sync System</h1>
          <StatusBar />
        </div>
        <Statistics />
        <TestInterface />
        <SyncControls />
        <StorageLogs />
      </div>
    </VCStorageProvider>
  );
}

export default App;