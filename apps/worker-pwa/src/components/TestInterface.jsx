import React, { useState, useEffect } from 'react';
import { useVCStorage } from '../context/VCStorageContext.jsx';
import './styles/TestInterface.css';

const TestInterface = () => {
    const [jsonInput, setJsonInput] = useState('');
    const [isValid, setIsValid] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const [presets, setPresets] = useState([]);
    const { storeVerificationResult } = useVCStorage();

    // Validate JSON in real-time
    useEffect(() => {
        if (!jsonInput.trim()) {
            setIsValid(true);
            return;
        }
        
        try {
            JSON.parse(jsonInput);
            setIsValid(true);
        } catch {
            setIsValid(false);
        }
    }, [jsonInput]);

    const simulateBlackBoxOutput = async () => {
        if (!jsonInput.trim()) {
            showNotification('Please enter some JSON data', 'warning');
            return;
        }

        setIsLoading(true);
        try {
            const data = JSON.parse(jsonInput);
            const result = await storeVerificationResult(data);
            if (result) {
                setLastResult({
                    success: true,
                    message: 'Data stored successfully!',
                    id: result,
                    timestamp: new Date()
                });
                showNotification('Data stored successfully!', 'success');
                setJsonInput(''); // Clear the input after successful storage
            } else {
                setLastResult({
                    success: false,
                    message: 'Error storing data',
                    timestamp: new Date()
                });
                showNotification('Error storing data', 'error');
            }
        } catch (e) {
            setLastResult({
                success: false,
                message: `Invalid JSON: ${e.message}`,
                timestamp: new Date()
            });
            showNotification(`Invalid JSON: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const generateSampleJSON = (type = 'random') => {
        let sample;
        
        switch (type) {
            case 'success':
                sample = {
                    status: 'success',
                    issuer: 'Government ID Authority',
                    subject: 'John Doe',
                    vcData: {
                        type: 'VerifiableCredential',
                        credentialSubject: {
                            id: 'did:example:' + Math.random().toString(36).substr(2, 9),
                            name: 'John Doe',
                            dateOfBirth: '1990-01-01',
                            nationality: 'US'
                        }
                    },
                    verificationDetails: {
                        signatureValid: true,
                        schemaValid: true,
                        notRevoked: true,
                        issuerTrusted: true
                    }
                };
                break;
            case 'failure':
                sample = {
                    status: 'failure',
                    issuer: 'Unknown Issuer',
                    subject: 'Jane Smith',
                    vcData: {
                        type: 'VerifiableCredential',
                        credentialSubject: {
                            id: 'did:example:' + Math.random().toString(36).substr(2, 9)
                        }
                    },
                    verificationDetails: {
                        signatureValid: false,
                        schemaValid: true,
                        notRevoked: true,
                        issuerTrusted: false
                    },
                    error: 'Invalid signature detected'
                };
                break;
            default:
                sample = {
                    status: Math.random() > 0.5 ? 'success' : 'failure',
                    issuer: 'Sample Issuer ' + Math.floor(Math.random() * 100),
                    subject: 'Sample Subject ' + Math.floor(Math.random() * 100),
                    vcData: {
                        type: 'VerifiableCredential',
                        credentialSubject: {
                            id: 'did:example:' + Math.random().toString(36).substr(2, 9)
                        }
                    },
                    verificationDetails: {
                        signatureValid: Math.random() > 0.3,
                        schemaValid: Math.random() > 0.2,
                        notRevoked: Math.random() > 0.1
                    }
                };
        }
        
        setJsonInput(JSON.stringify(sample, null, 2));
    };

    const formatJSON = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            setJsonInput(JSON.stringify(parsed, null, 2));
        } catch {
            showNotification('Cannot format invalid JSON', 'error');
        }
    };

    const clearInput = () => {
        setJsonInput('');
        setLastResult(null);
    };

    const showNotification = (message, type) => {
        // Simple notification - you could replace this with a toast library
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    };

    const presetTemplates = [
        { name: 'Success Case', type: 'success', icon: '✅' },
        { name: 'Failure Case', type: 'failure', icon: '❌' },
        { name: 'Random Data', type: 'random', icon: '🎲' }
    ];

    return (
        <div className="test-interface-container">
            <div className="test-header">
                <h2 className="test-title">
                    <span className="test-icon">🧪</span>
                    Test Interface
                </h2>
                <div className="test-subtitle">
                    Simulate verification output data
                </div>
            </div>

            <div className="test-description">
                <p>
                    This interface simulates the output from your verification black box. 
                    Paste or generate JSON data to test the storage and sync functionality.
                </p>
            </div>

            {/* Quick Templates */}
            <div className="templates-section">
                <h3 className="section-title">
                    <span className="section-icon">⚡</span>
                    Quick Templates
                </h3>
                <div className="templates-grid">
                    {presetTemplates.map(template => (
                        <button
                            key={template.type}
                            onClick={() => generateSampleJSON(template.type)}
                            className="template-button"
                        >
                            <span className="template-icon">{template.icon}</span>
                            {template.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* JSON Input Section */}
            <div className="input-section">
                <div className="input-header">
                    <h3 className="section-title">
                        <span className="section-icon">📝</span>
                        JSON Input
                    </h3>
                    <div className="input-controls">
                        <button
                            onClick={formatJSON}
                            disabled={!jsonInput.trim() || !isValid}
                            className="control-btn format-btn"
                            title="Format JSON"
                        >
                            📐 Format
                        </button>
                        <button
                            onClick={clearInput}
                            disabled={!jsonInput.trim()}
                            className="control-btn clear-btn"
                            title="Clear Input"
                        >
                            🗑️ Clear
                        </button>
                    </div>
                </div>

                <div className={`json-input-container ${!isValid ? 'invalid' : ''}`}>
                    <textarea
                        className="json-input"
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        placeholder={`{
  "status": "success",
  "issuer": "Government Authority",
  "subject": "John Doe",
  "vcData": {
    "type": "VerifiableCredential",
    "credentialSubject": {
      "id": "did:example:123456789"
    }
  },
  "verificationDetails": {
    "signatureValid": true,
    "schemaValid": true,
    "notRevoked": true
  }
}`}
                    />
                    {!isValid && (
                        <div className="validation-error">
                            ⚠️ Invalid JSON format
                        </div>
                    )}
                </div>

                <div className="input-stats">
                    <span className="char-count">
                        {jsonInput.length} characters
                    </span>
                    {jsonInput.trim() && (
                        <span className={`json-status ${isValid ? 'valid' : 'invalid'}`}>
                            {isValid ? '✅ Valid JSON' : '❌ Invalid JSON'}
                        </span>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="action-section">
                <button
                    onClick={simulateBlackBoxOutput}
                    disabled={!jsonInput.trim() || !isValid || isLoading}
                    className="store-button"
                >
                    {isLoading ? (
                        <>
                            <span className="loading-spinner"></span>
                            Storing...
                        </>
                    ) : (
                        <>
                            <span className="button-icon">💾</span>
                            Store in IndexedDB
                        </>
                    )}
                </button>
            </div>

            {/* Last Result */}
            {lastResult && (
                <div className={`result-section result-${lastResult.success ? 'success' : 'error'}`}>
                    <div className="result-header">
                        <span className="result-icon">
                            {lastResult.success ? '✅' : '❌'}
                        </span>
                        <div className="result-info">
                            <div className="result-message">{lastResult.message}</div>
                            <div className="result-timestamp">
                                {lastResult.timestamp.toLocaleTimeString()}
                                {lastResult.id && ` • ID: ${lastResult.id}`}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Help Section */}
            <div className="help-section">
                <details className="help-details">
                    <summary className="help-summary">
                        <span className="help-icon">💡</span>
                        JSON Structure Help
                    </summary>
                    <div className="help-content">
                        <h4>Required Fields:</h4>
                        <ul>
                            <li><code>status</code> - "success" or "failure"</li>
                            <li><code>issuer</code> - Name of the credential issuer</li>
                            <li><code>subject</code> - Subject of the credential</li>
                        </ul>
                        <h4>Optional Fields:</h4>
                        <ul>
                            <li><code>vcData</code> - Verifiable credential data</li>
                            <li><code>verificationDetails</code> - Verification results</li>
                            <li><code>error</code> - Error message (for failures)</li>
                        </ul>
                    </div>
                </details>
            </div>
        </div>
    );
};

export default TestInterface;