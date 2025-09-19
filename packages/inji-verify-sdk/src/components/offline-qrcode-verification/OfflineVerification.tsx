import React from 'react';
import QRCodeVerification from '../qrcode-verification/QRCodeVerification';
import { VerificationResult } from '../../services/offline-verifier/data/data';
import { CredentialFormat } from '../../services/offline-verifier/constants/CredentialFormat';

interface OfflineVerificationProps {
  onVerificationResult: (result: VerificationResult) => void;
  onError: (error: Error) => void;
  credentialFormat?: CredentialFormat;
  triggerElement?: React.ReactNode;
  isEnableUpload?: boolean;
  isEnableScan?: boolean;
  isEnableZoom?: boolean;
  uploadButtonId?: string;
  uploadButtonStyle?: string;
}

/**
 * OfflineVerification Component
 * 
 * A simplified wrapper around QRCodeVerification that's pre-configured 
 * for offline verification mode. This provides a cleaner API for users
 * who only need offline verification.
 */
const OfflineVerification: React.FC<OfflineVerificationProps> = (props) => {
  return (
    <QRCodeVerification
      {...props}
      mode="offline"
    />
  );
};

export default OfflineVerification;
