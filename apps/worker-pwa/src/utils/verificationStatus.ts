import type { VerificationResult } from '@mosip/react-inji-verify-sdk';

export type VerificationLogStatus = 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';

const EXPIRED_CODES = new Set(['VC_EXPIRED', 'ERR_VC_EXPIRED', 'EXPIRED']);
const REVOKED_CODES = new Set(['VC_REVOKED', 'ERR_VC_REVOKED', 'REVOKED']);
const SUSPENDED_CODES = new Set(['VC_SUSPENDED', 'ERR_VC_SUSPENDED', 'SUSPENDED']);

const normalizeCode = (code?: string | null) => (code ?? '').toString().trim().toUpperCase();

export const deriveVerificationLogStatus = (result: VerificationResult): VerificationLogStatus => {
  const code = normalizeCode(result?.verificationErrorCode);

  if (code && EXPIRED_CODES.has(code)) {
    return 'EXPIRED';
  }
  if (code && REVOKED_CODES.has(code)) {
    return 'REVOKED';
  }
  if (code && SUSPENDED_CODES.has(code)) {
    return 'SUSPENDED';
  }

  return result?.verificationStatus ? 'SUCCESS' : 'FAILED';
};

export const deriveVerificationErrorMessage = (result: VerificationResult): string | null => {
  const status = deriveVerificationLogStatus(result);
  if (status === 'SUCCESS') {
    return null;
  }

  const message = (result?.verificationMessage ?? '').toString().trim();
  return message.length > 0 ? message : null;
};
