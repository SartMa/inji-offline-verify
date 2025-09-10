import { Decoder, Encoder } from 'cbor-x';

const cborDecoder = new Decoder();
const cborEncoder = new Encoder();

// Type aliases (equivalent to Kotlin typealias)
export type IssuerAuth = any[] | null;  // Array?
export type IssuerSignedNamespaces = Record<string, any>;  // Map

/**
 * Extract field value from issuer signed namespaces
 * Equivalent to Kotlin's IssuerSignedNamespaces.extractFieldValue()
 */
export function extractFieldValue(issuerSignedNamespaces: IssuerSignedNamespaces, fieldToBeExtracted: string): string {
  for (const namespace of Object.keys(issuerSignedNamespaces)) {
    const namespaceData = issuerSignedNamespaces[namespace];
    
    if (!Array.isArray(namespaceData)) continue;
    
    for (const issuerSignedItem of namespaceData) {
      try {
        // Encode the item (equivalent to CborEncoder)
        const encodedIssuerSignedItem = cborEncoder.encode(issuerSignedItem);
        
        // Decode the item (equivalent to CborDecoder)
        const bytes = issuerSignedItem.bytes || issuerSignedItem;
        const decodedIssuerSignedItem = cborDecoder.decode(bytes);
        
        const elementIdentifier = decodedIssuerSignedItem.elementIdentifier;
        
        if (elementIdentifier === fieldToBeExtracted) {
          return decodedIssuerSignedItem.elementValue || '';
        }
      } catch (error) {
        continue;
      }
    }
  }
  return '';
}

/**
 * Extract MSO from IssuerAuth
 * Equivalent to Kotlin's IssuerAuth.extractMso()
 */
export function extractMso(issuerAuth: IssuerAuth): any {
  if (!issuerAuth) {
    console.error("IssuerAuth in credential is not available");
    throw new Error("Invalid Issuer Auth");
  }

  // Get payload (equivalent to this.get(2))
  const payloadBytes = issuerAuth[2];
  const decodedPayload = cborDecoder.decode(payloadBytes);
  
  let mso;
  if (typeof decodedPayload === 'object' && !Array.isArray(decodedPayload) && !(decodedPayload instanceof Uint8Array)) {
    // MAP type
    mso = decodedPayload;
  } else if (decodedPayload instanceof Uint8Array) {
    // BYTE_STRING type - decode again
    mso = cborDecoder.decode(decodedPayload);
  } else {
    throw new Error("Invalid Issuer Auth");
  }
  
  return mso;
}

/**
 * Data structure equivalent to Kotlin's MsoMdocCredentialData
 */
export interface MsoMdocCredentialData {
  docType: any | null;
  issuerSigned: IssuerSigned;
}

export interface IssuerSigned {
  issuerAuth: IssuerAuth;
  namespaces: IssuerSignedNamespaces;
}

/**
 * DataItem accessor functions (equivalent to Kotlin operator functions)
 */
export function getProperty(dataItem: any, name: string): any {
  if (typeof dataItem === 'object' && dataItem !== null) {
    return dataItem[name];
  }
  throw new Error('DataItem is not a MAP type');
}

export function getElement(dataItem: any, index: number): any {
  if (Array.isArray(dataItem)) {
    return dataItem[index];
  }
  throw new Error('DataItem is not an ARRAY type');
}