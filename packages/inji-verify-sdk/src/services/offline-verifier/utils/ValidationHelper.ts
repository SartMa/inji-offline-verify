import { CredentialValidatorConstants } from '../constants/CredentialValidatorConstants.js';

/**
 * Validation Exception interface to match Kotlin ValidationException
 */
interface ValidationException {
  errorMessage: string;
  errorCode: string;
}

/**
 * ValidationHelper class - matches Kotlin ValidationHelper functionality
 */
export class ValidationHelper {

  /**
   * Check mandatory fields in the credential object
   * @param vcJsonObject - The credential object to validate
   * @param fields - Array of required field names
   * @throws ValidationException if any required field is missing
   */
  checkMandatoryFields(vcJsonObject: any, fields: string[]): void {
    for (const field of fields) {
      const keys = field.split('.');
      let currentJson: any = vcJsonObject;

      for (const key of keys) {
        if (currentJson && typeof currentJson === 'object' && currentJson.hasOwnProperty(key)) {
          if (typeof currentJson[key] === 'object' && !Array.isArray(currentJson[key])) {
            currentJson = currentJson[key];
          } else {
            break;
          }
        } else {
          const specificErrorCode = `${CredentialValidatorConstants.ERROR_CODE_MISSING}${field.replace('.', '_').toUpperCase()}`;
          throw {
            errorMessage: `${CredentialValidatorConstants.ERROR_MISSING_REQUIRED_FIELDS}${field}`,
            errorCode: specificErrorCode
          } as ValidationException;
        }
      }
    }
  }

  /**
   * Validate proof field using JWS and proof type validation
   * @param vcJsonString - JSON string of the credential
   * @throws ValidationException if proof validation fails
   */
  validateProof(vcJsonString: string): void {
    try {
      const vcJsonObject = JSON.parse(vcJsonString);
      
      if (!vcJsonObject[CredentialValidatorConstants.PROOF]) {
        throw {
          errorMessage: `${CredentialValidatorConstants.ERROR_MISSING_REQUIRED_FIELDS}${CredentialValidatorConstants.PROOF}`,
          errorCode: `${CredentialValidatorConstants.ERROR_CODE_MISSING}${CredentialValidatorConstants.PROOF.toUpperCase()}`
        } as ValidationException;
      }

      const proof = vcJsonObject[CredentialValidatorConstants.PROOF];
      
      // Validate JWS if present
      if (proof[CredentialValidatorConstants.JWS]) {
        const jwsToken = proof[CredentialValidatorConstants.JWS];
        if (!jwsToken || jwsToken.length === 0) {
          throw {
            errorMessage: CredentialValidatorConstants.ERROR_MESSAGE_ALGORITHM_NOT_SUPPORTED,
            errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${CredentialValidatorConstants.ALGORITHM.toUpperCase()}`
          } as ValidationException;
        }

        // Extract algorithm from JWS header
        try {
          const parts = jwsToken.split('.');
          if (parts.length !== 3) {
            throw new Error('Invalid JWS format');
          }
          
          const header = JSON.parse(this.base64UrlDecode(parts[0]));
          const algorithmName = header.alg;
          
          if (!CredentialValidatorConstants.ALGORITHMS_SUPPORTED.includes(algorithmName)) {
            throw {
              errorMessage: CredentialValidatorConstants.ERROR_MESSAGE_ALGORITHM_NOT_SUPPORTED,
              errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${CredentialValidatorConstants.ALGORITHM.toUpperCase()}`
            } as ValidationException;
          }
        } catch (error) {
          throw {
            errorMessage: CredentialValidatorConstants.ERROR_MESSAGE_ALGORITHM_NOT_SUPPORTED,
            errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${CredentialValidatorConstants.ALGORITHM.toUpperCase()}`
          } as ValidationException;
        }
      }

      // Validate proof type
      const proofType = proof[CredentialValidatorConstants.TYPE];
      if (!CredentialValidatorConstants.PROOF_TYPES_SUPPORTED.includes(proofType)) {
        throw {
          errorMessage: CredentialValidatorConstants.ERROR_MESSAGE_PROOF_TYPE_NOT_SUPPORTED,
          errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${CredentialValidatorConstants.PROOF.toUpperCase()}_${CredentialValidatorConstants.TYPE.toUpperCase()}`
        } as ValidationException;
      }

    } catch (error: any) {
      if (error.errorMessage && error.errorCode) {
        throw error;
      }
      throw {
        errorMessage: `Proof validation failed: ${error.message}`,
        errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${CredentialValidatorConstants.PROOF.toUpperCase()}`
      } as ValidationException;
    }
  }

  /**
   * Validate ID field if present
   * @param vcJsonObject - The credential object
   * @throws ValidationException if ID is invalid
   */
  validateId(vcJsonObject: any): void {
    if (vcJsonObject.hasOwnProperty(CredentialValidatorConstants.ID)) {
      const id = vcJsonObject[CredentialValidatorConstants.ID];
      if (!this.isValidUri(id)) {
        throw {
          errorMessage: `${CredentialValidatorConstants.ERROR_INVALID_URI}${CredentialValidatorConstants.ID}`,
          errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${CredentialValidatorConstants.ID}`
        } as ValidationException;
      }
    }
  }

  /**
   * Validate type field
   * @param vcJsonObject - The credential object
   * @throws ValidationException if type validation fails
   */
  validateType(vcJsonObject: any): void {
    if (vcJsonObject.hasOwnProperty(CredentialValidatorConstants.TYPE)) {
      const types = Array.isArray(vcJsonObject[CredentialValidatorConstants.TYPE]) 
        ? vcJsonObject[CredentialValidatorConstants.TYPE] 
        : [vcJsonObject[CredentialValidatorConstants.TYPE]];
      
      if (!types.includes(CredentialValidatorConstants.VERIFIABLE_CREDENTIAL)) {
        throw {
          errorMessage: CredentialValidatorConstants.ERROR_MESSAGE_TYPE_VERIFIABLE_CREDENTIAL,
          errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${CredentialValidatorConstants.TYPE.toUpperCase()}`
        } as ValidationException;
      }
    }
  }

  /**
   * Validate issuer field
   * @param vcJsonObject - The credential object
   * @throws ValidationException if issuer validation fails
   */
  validateIssuer(vcJsonObject: any): void {
    if (vcJsonObject.hasOwnProperty(CredentialValidatorConstants.ISSUER)) {
      const issuer = vcJsonObject[CredentialValidatorConstants.ISSUER];
      const issuerId = this.getId(issuer);
      
      if (!issuerId || !this.isValidUri(issuerId)) {
        throw {
          errorMessage: `${CredentialValidatorConstants.ERROR_INVALID_URI}${CredentialValidatorConstants.ISSUER}`,
          errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${CredentialValidatorConstants.ISSUER.toUpperCase()}`
        } as ValidationException;
      }
    }
  }

  /**
   * Validate name and description fields for V2.0
   * @param vcJsonObject - The credential object
   * @throws ValidationException if validation fails
   */
  validateNameAndDescription(vcJsonObject: any): void {
    const nameDescriptionList: Array<[string, string]> = [
      [CredentialValidatorConstants.NAME, CredentialValidatorConstants.ERROR_MESSAGE_NAME],
      [CredentialValidatorConstants.DESCRIPTION, CredentialValidatorConstants.ERROR_MESSAGE_DESCRIPTION]
    ];

    nameDescriptionList.forEach(([fieldName, errorMessage]) => {
      if (vcJsonObject.hasOwnProperty(fieldName)) {
        const fieldValue = vcJsonObject[fieldName];
        
        if (typeof fieldValue === 'string') {
          return; // Valid string
        } else if (Array.isArray(fieldValue)) {
          this.checkForLanguageObject(fieldValue, [fieldName, errorMessage]);
        } else {
          throw {
            errorMessage: errorMessage,
            errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${fieldName.toUpperCase()}`
          } as ValidationException;
        }
      }
    });
  }

  /**
   * Validate credential subject
   * @param vcJsonObject - The credential object
   * @throws ValidationException if validation fails
   */
  validateCredentialSubject(vcJsonObject: any): void {
    const credentialSubject = vcJsonObject[CredentialValidatorConstants.CREDENTIAL_SUBJECT];
    this.validateJsonObjectOrArray(
      CredentialValidatorConstants.CREDENTIAL_SUBJECT,
      credentialSubject,
      this.validateSingleCredentialObject.bind(this),
      CredentialValidatorConstants.ERROR_CREDENTIAL_SUBJECT_NON_NULL_OBJECT
    );
  }

  /**
   * Validate fields by ID and Type requirements
   * @param vcJsonObject - The credential object
   * @param fieldName - Name of the field to validate
   * @param idMandatoryFields - List of fields that require ID
   * @throws ValidationException if validation fails
   */
  validateFieldsByIdAndType(vcJsonObject: any, fieldName: string, idMandatoryFields: string[]): void {
    const fieldValue = vcJsonObject[fieldName];
    this.validateJsonObjectOrArray(
      fieldName,
      fieldValue,
      (obj: any) => this.validateSingleObject(fieldName, obj, idMandatoryFields),
      `${CredentialValidatorConstants.ERROR_INVALID_FIELD}${fieldName}`
    );
  }

  // --- Private Helper Methods ---

  private checkForLanguageObject(nameOrDescriptionArray: any[], fieldPair: [string, string]): void {
    for (const item of nameOrDescriptionArray) {
      if (typeof item !== 'object' || !item.hasOwnProperty(CredentialValidatorConstants.LANGUAGE)) {
        throw {
          errorMessage: fieldPair[1],
          errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${fieldPair[0].toUpperCase()}`
        } as ValidationException;
      }
    }
  }

  private validateJsonObjectOrArray(
    fieldName: string,
    value: any,
    validator: (obj: any) => string,
    errorMessage: string
  ): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item !== 'object' || item === null) {
          throw {
            errorMessage: errorMessage,
            errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${fieldName.toUpperCase()}`
          } as ValidationException;
        }
        const result = validator(item);
        if (result.length > 0) {
          throw {
            errorMessage: errorMessage,
            errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${fieldName.toUpperCase()}`
          } as ValidationException;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      validator(value);
    } else {
      throw {
        errorMessage: errorMessage,
        errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${fieldName.toUpperCase()}`
      } as ValidationException;
    }
  }

  private validateSingleCredentialObject(credentialSubjectObject: any): string {
    if (credentialSubjectObject.hasOwnProperty(CredentialValidatorConstants.ID)) {
      const id = credentialSubjectObject[CredentialValidatorConstants.ID];
      if (!this.isValidUri(id)) {
        throw {
          errorMessage: `${CredentialValidatorConstants.ERROR_INVALID_URI}${CredentialValidatorConstants.CREDENTIAL_SUBJECT}.${CredentialValidatorConstants.ID}`,
          errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${CredentialValidatorConstants.CREDENTIAL_SUBJECT}${CredentialValidatorConstants.ID.toUpperCase()}`
        } as ValidationException;
      }
    }
    return '';
  }

  private validateSingleObject(fieldName: string, fieldValueObject: any, idMandatoryFields: string[]): string {
    if (!fieldValueObject.hasOwnProperty(CredentialValidatorConstants.TYPE)) {
      throw {
        errorMessage: `${CredentialValidatorConstants.ERROR_MISSING_REQUIRED_FIELDS}${fieldName}.${CredentialValidatorConstants.TYPE}`,
        errorCode: `${CredentialValidatorConstants.ERROR_CODE_MISSING}${fieldName.toUpperCase()}_${CredentialValidatorConstants.TYPE.toUpperCase()}`
      } as ValidationException;
    }

    const isIDMandatoryField = idMandatoryFields.includes(fieldName);
    if (isIDMandatoryField && !fieldValueObject.hasOwnProperty(CredentialValidatorConstants.ID)) {
      throw {
        errorMessage: `${CredentialValidatorConstants.ERROR_MISSING_REQUIRED_FIELDS}${fieldName}.${CredentialValidatorConstants.ID}`,
        errorCode: `${CredentialValidatorConstants.ERROR_CODE_MISSING}${fieldName.toUpperCase()}_${CredentialValidatorConstants.ID.toUpperCase()}`
      } as ValidationException;
    }

    const id = fieldValueObject[CredentialValidatorConstants.ID];
    if (id && id.length > 0) {
      if (!this.isValidUri(id)) {
        throw {
          errorMessage: `${CredentialValidatorConstants.ERROR_INVALID_URI}${fieldName}.${CredentialValidatorConstants.ID}`,
          errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${fieldName.toUpperCase()}_${CredentialValidatorConstants.ID.toUpperCase()}`
        } as ValidationException;
      }
    }

    return '';
  }

  private getId(obj: any): string | null {
    if (typeof obj === 'string') {
      return obj;
    }
    if (typeof obj === 'object' && obj !== null && obj.hasOwnProperty('id')) {
      return obj.id;
    }
    return null;
  }

  private isValidUri(value: string): boolean {
    try {
      const url = new URL(value);
      return (value.startsWith('did:')) || (url.protocol !== null && url.hostname !== null);
    } catch {
      // Fallback for DID URIs
      return value.includes(':');
    }
  }

  private base64UrlDecode(input: string): string {
    // Add padding if needed
    let padded = input;
    const remainder = padded.length % 4;
    if (remainder > 0) {
      padded += '='.repeat(4 - remainder);
    }
    
    // Replace base64url characters with standard base64
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    
    // Decode
    return atob(base64);
  }
}