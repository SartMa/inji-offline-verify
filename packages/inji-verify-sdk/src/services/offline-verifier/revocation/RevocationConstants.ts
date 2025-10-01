export const RevocationErrorCodes = {
  STATUS_RETRIEVAL_ERROR: 'STATUS_RETRIEVAL_ERROR',
  STATUS_VERIFICATION_ERROR: 'STATUS_VERIFICATION_ERROR',
  STATUS_LIST_LENGTH_ERROR: 'STATUS_LIST_LENGTH_ERROR',
  RANGE_ERROR: 'RANGE_ERROR'
} as const;
export type RevocationErrorCode = typeof RevocationErrorCodes[keyof typeof RevocationErrorCodes];

export const RevocationMessages: Record<string, string> = {
  STATUS_RETRIEVAL_ERROR: 'Failed to retrieve status list credential',
  STATUS_VERIFICATION_ERROR: 'Failed to verify status list credential',
  STATUS_LIST_LENGTH_ERROR: 'Status list length below minimum herd privacy threshold',
  RANGE_ERROR: 'Credential status index out of range'
};

export const BITSTRING_MIN_ENTRIES = 131072; // per spec (can be overridden by ecosystem)
export const BITSTRING_STATUS_ENTRY_TYPE = 'BitstringStatusListEntry';
export const BITSTRING_STATUS_VC_TYPE = 'BitstringStatusListCredential';
