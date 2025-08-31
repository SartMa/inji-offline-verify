import React, { useState, useContext } from 'react';
import { VCStorageContext } from '../context/VCStorageContext';

const TestInterface = () => {
    const [jsonInput, setJsonInput] = useState('');
    const { storeVC } = useContext(VCStorageContext);

    const simulateBlackBoxOutput = async () => {
        try {
            const data = JSON.parse(jsonInput);
            const result = await storeVC(data);
            if (result.success) {
                alert('Data stored successfully!');
            } else {
                alert('Error storing data: ' + result.error);
            }
        } catch (e) {
            alert('Invalid JSON: ' + e.message);
        }
    };

    const generateSampleJSON = () => {
        const sample = {
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
                signatureValid: true,
                schemaValid: true,
                notRevoked: true
            }
        };
        setJsonInput(JSON.stringify(sample, null, 2));
    };

    return (
        <div className="card">
            <h2>🧪 Test Interface (Simulate Black Box Output)</h2>
            <p style={{ marginBottom: '10px', color: '#6b7280' }}>
                Paste JSON from verification logic here to simulate what your black box will send:
            </p>
            <textarea
                className="json-input"
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{"status": "success", "issuer": "Test Issuer", "subject": "Test Subject", "vcData": {...}}'
            ></textarea>
            <button className="btn btn-primary" onClick={simulateBlackBoxOutput}>Store in IndexedDB</button>
            <button className="btn btn-secondary" onClick={generateSampleJSON}>Generate Sample JSON</button>
        </div>
    );
};

export default TestInterface;