import { expandCompressedBitstring } from './BitstringExpansion';
import { StatusListLoader } from './StatusListLoader';
import { RevocationErrorCodes, RevocationMessages, BITSTRING_MIN_ENTRIES, BITSTRING_STATUS_ENTRY_TYPE } from './RevocationConstants';
import { CredentialVerifierFactory } from '../credential-verifier/credentialVerifierFactory';
import { CredentialFormat } from '../constants/CredentialFormat';

export interface RevocationCheckResult {
  valid: boolean;           // true if not revoked
  status: number;           // raw status bit (0 == valid, 1 == revoked)
  purpose: string;          // statusPurpose
  message?: string;         // optional status message mapping in future
  errorCode?: string;       // populated if retrieval/verification failed
  errorMessage?: string;    // human readable error
}

export class RevocationChecker {
  private loader = new StatusListLoader();
  private logger = console;

  /**
   * Performs revocation check if credential has BitstringStatusListEntry credentialStatus.
   * Returns null if credential does not declare a bitstring status entry.
   */
  async check(credentialJson: any): Promise<RevocationCheckResult | null> {
    try {
      const statusEntry = credentialJson?.credentialStatus;
      if (!statusEntry) return null; // no status section

      // Support object or array forms
      const entries = Array.isArray(statusEntry) ? statusEntry : [statusEntry];
      this.logger.info('[RevocationChecker] Found credentialStatus entries:', entries);
      const bitstringEntry = entries.find(e => this.isBitstringEntry(e));
      if (!bitstringEntry) return null; // different status method

      const statusListCredentialUrl = bitstringEntry.statusListCredential || bitstringEntry.status_list_credential || bitstringEntry.statusList || bitstringEntry.id;
      const statusListIndexStr = bitstringEntry.statusListIndex || bitstringEntry.status_list_index || bitstringEntry.statusListEntry || bitstringEntry.statusListPosition;
  // Raw (possibly array) purpose value present in the credential's status entry
  const statusPurpose = bitstringEntry.statusPurpose || bitstringEntry.status_purpose;

      this.logger.info('[RevocationChecker] Using bitstring entry', {
        statusListCredentialUrl,
        statusListIndex: statusListIndexStr,
        statusPurpose
      });

      if (!statusListCredentialUrl || statusListIndexStr === undefined) {
        throw this.error(RevocationErrorCodes.STATUS_VERIFICATION_ERROR, 'Missing status list credential URL or index');
      }

      const statusListIndex = Number(statusListIndexStr);
      if (!Number.isInteger(statusListIndex) || statusListIndex < 0) {
        throw this.error(RevocationErrorCodes.STATUS_VERIFICATION_ERROR, 'Invalid status list index');
      }

      // Load status list credential (cache-first)
      const statusListVC = await this.loader.load(statusListCredentialUrl);
      this.logger.info('[RevocationChecker] Loaded status list credential', {
        id: statusListVC.id,
        statusPurpose: statusListVC.statusPurpose,
        encodedListLength: statusListVC.encodedList?.length
      });

      if (!statusListVC.encodedList) {
        throw this.error(RevocationErrorCodes.STATUS_VERIFICATION_ERROR, 'Status list credential missing encodedList');
      }

      // Verify the integrity of the status list credential itself (signature/proof)
      if (statusListVC.raw) {
        try {
          const statusListString = typeof statusListVC.raw === 'string' ? statusListVC.raw : JSON.stringify(statusListVC.raw);
          const statusListVerifier = new CredentialVerifierFactory().get(CredentialFormat.LDP_VC);
          const validation = statusListVerifier.validate(statusListString);
          if (validation.validationMessage.length > 0) {
            throw new Error(validation.validationMessage);
          }
          const proofOk = await statusListVerifier.verify(statusListString);
          if (!proofOk) {
            throw new Error('Status list proof verification failed');
          }
        } catch (proofErr: any) {
          this.logger.error('[RevocationChecker] Status list proof verification failed:', proofErr?.message || proofErr);
          throw this.error(RevocationErrorCodes.STATUS_VERIFICATION_ERROR, 'Unable to verify status list credential proof');
        }
      }

      // Normalize purposes to arrays per spec ("one or more strings")
      const normalizePurpose = (p: any): string[] => {
        if (p == null) return [];
        return (Array.isArray(p) ? p : [p]).map(v => String(v));
      };
      const entryPurposes = normalizePurpose(statusPurpose);
      const listPurposesRaw = statusListVC.statusPurpose || statusListVC.raw?.credentialSubject?.statusPurpose;
      const listPurposes = normalizePurpose(listPurposesRaw);

      if (entryPurposes.length && listPurposes.length) {
        const overlaps = entryPurposes.filter(p => listPurposes.includes(p));
        if (overlaps.length === 0) {
          throw this.error(RevocationErrorCodes.STATUS_VERIFICATION_ERROR, `Status purpose mismatch (no overlap) entry=${entryPurposes.join(',')} list=${listPurposes.join(',')}`);
        }
      }

      // Choose a single purpose to surface (first overlap, else first declared)
      const chosenPurpose = (entryPurposes.find(p => listPurposes.includes(p)) || entryPurposes[0] || listPurposes[0] || 'unknown');

      // Expand bitstring
      const expanded = await expandCompressedBitstring(statusListVC.encodedList);
      this.logger.info('[RevocationChecker] Expanded bitstring length (bytes):', expanded.length);

      // Each status is a bit (size=1). Determine minimum length requirement.
      if (expanded.length * 8 < BITSTRING_MIN_ENTRIES) {
        throw this.error(RevocationErrorCodes.STATUS_LIST_LENGTH_ERROR, 'Expanded status list below minimum herd privacy length');
      }

      const bitPosition = statusListIndex; // size = 1 bit
      const byteIndex = Math.floor(bitPosition / 8);
      const bitOffset = bitPosition % 8;
      if (byteIndex < 0 || byteIndex >= expanded.length) {
        throw this.error(RevocationErrorCodes.RANGE_ERROR, 'Status index outside range of status list');
      }

  const byte = expanded[byteIndex];
  // Generation code sets bits using (7 - bitPosition) i.e. MSB-first
  const statusBit = (byte >> (7 - bitOffset)) & 0x01; // 0=clear,1=set

      this.logger.info('[RevocationChecker] Status bit evaluation', {
        statusListIndex,
        byteIndex,
        bitOffset,
        byteValue: byte,
        statusBit
      });

      // Classification semantics per chosen purpose
      // revocation: bit=1 => invalid (revoked)
      // suspension: bit=1 => invalid (temporarily suspended)
      // refresh: bit=1 => still valid (signal only)
      // message: bit=1 => still valid; message mapping (future)
      // unknown: treat like revocation (conservative) if bit=1

      const resultPurpose = chosenPurpose; // rename for clarity
      const buildBase = (extra: Partial<RevocationCheckResult>): RevocationCheckResult => ({
        valid: true,
        status: statusBit,
        purpose: resultPurpose,
        ...extra
      });

      if (statusBit === 1) {
        switch (resultPurpose) {
          case 'revocation':
            return buildBase({ valid: false, message: 'Credential revoked' });
          case 'suspension':
            return buildBase({ valid: false, message: 'Credential suspended' });
          case 'refresh':
            return buildBase({ valid: true, message: 'Updated credential available (refresh)' });
          case 'message':
            // TODO: Implement statusMessages lookup using statusSize; placeholder message
            return buildBase({ valid: true, message: 'Status message present' });
          default:
            return buildBase({ valid: false, message: 'Credential status bit set (treated as revoked)' });
        }
      }

      // statusBit == 0
      return buildBase({});
    } catch (e: any) {
      if (e?.code && RevocationMessages[e.code]) {
        return { valid: false, status: 1, purpose: 'unknown', errorCode: e.code, errorMessage: e.message };
      }
      // Unexpected error
      this.logger.error('[RevocationChecker] Unexpected error:', e);
      return { valid: false, status: 1, purpose: 'unknown', errorCode: RevocationErrorCodes.STATUS_VERIFICATION_ERROR, errorMessage: e?.message || 'Unknown revocation error' };
    }
  }

  private isBitstringEntry(entry: any): boolean {
    if (!entry) return false;
    const types = entry.type ? (Array.isArray(entry.type) ? entry.type : [entry.type]) : [];
    return types.includes(BITSTRING_STATUS_ENTRY_TYPE) || 'statusListIndex' in entry;
  }

  private error(code: string, message: string): Error {
    const err: any = new Error(message || RevocationMessages[code] || code);
    err.code = code;
    return err;
  }
}
