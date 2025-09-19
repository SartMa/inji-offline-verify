import { CredentialValidatorConstants } from '../../constants/CredentialValidatorConstants.js';
import { ValidationHelper } from '../../utils/ValidationHelper.js';
import { DateUtils } from '../../utils/DateUtils.js';
import { Util, DATA_MODEL } from '../../utils/Util.js';
import { ValidationException } from '../../exception/ValidationException.js';

/**
 * Validation Status class to match Kotlin ValidationStatus
 */
export class ValidationStatus {
  public validationMessage: string;
  public validationErrorCode: string;

  constructor(
    validationMessage: string,
    validationErrorCode: string
  ) {
    this.validationMessage = validationMessage;
    this.validationErrorCode = validationErrorCode;
  }
}

/**
 * LDP Validator - matches Kotlin LdpValidator functionality exactly
 */
export class LdpValidator {
  private readonly commonMandatoryFields = [
    CredentialValidatorConstants.CONTEXT,
    CredentialValidatorConstants.TYPE,
    CredentialValidatorConstants.CREDENTIAL_SUBJECT,
    CredentialValidatorConstants.ISSUER,
    CredentialValidatorConstants.PROOF
  ];

  // All Fields has Type Property as mandatory with few fields as ID as mandatory.
  private readonly allFieldsWithIDAndType = [
    CredentialValidatorConstants.PROOF,
    CredentialValidatorConstants.CREDENTIAL_STATUS,
    CredentialValidatorConstants.EVIDENCE,
    CredentialValidatorConstants.CREDENTIAL_SCHEMA,
    CredentialValidatorConstants.REFRESH_SERVICE,
    CredentialValidatorConstants.TERMS_OF_USE
  ];

  private validationHelper: ValidationHelper;

  constructor() {
    this.validationHelper = new ValidationHelper();
    // CHANGE: Removed 'this.util = new Util()'. Util methods will be called statically.
  }

  /**
   * Main validation function - matches Kotlin logic exactly
   * @param credential - JSON string of the credential
   * @returns ValidationStatus object
   */
  validate(credential: string): ValidationStatus {
    try {
      // CHANGE: Now throws an exception instead of returning a status.
      if (!credential || credential.length === 0) {
        throw new ValidationException(
          CredentialValidatorConstants.ERROR_MESSAGE_EMPTY_VC_JSON,
          CredentialValidatorConstants.ERROR_CODE_EMPTY_VC_JSON
        );
      }

      const vcJsonObject = JSON.parse(credential);

      // Assumes Util methods are static, just like in Kotlin.
      const contextVersion = Util.getContextVersion(vcJsonObject);
      
      // CHANGE: Now throws an exception instead of returning a status.
      if (!contextVersion) {
          throw new ValidationException(
            `${CredentialValidatorConstants.ERROR_MISSING_REQUIRED_FIELDS}${CredentialValidatorConstants.CONTEXT}`,
            `${CredentialValidatorConstants.ERROR_CODE_MISSING}${CredentialValidatorConstants.CONTEXT.toUpperCase()}`
        );
      }

      switch (contextVersion) {
        case DATA_MODEL.DATA_MODEL_1_1: {
          this.validateV1SpecificFields(vcJsonObject);
          this.validateCommonFields(vcJsonObject);
          
          const isExpired = vcJsonObject[CredentialValidatorConstants.EXPIRATION_DATE] && DateUtils.isVCExpired(vcJsonObject[CredentialValidatorConstants.EXPIRATION_DATE]);
          
          const expirationMessage = isExpired ? CredentialValidatorConstants.ERROR_MESSAGE_VC_EXPIRED : '';
          const verificationStatusCode = isExpired ? CredentialValidatorConstants.ERROR_CODE_VC_EXPIRED : '';
          
          return new ValidationStatus(expirationMessage, verificationStatusCode);
        }
        case DATA_MODEL.DATA_MODEL_2_0: {
          this.validateV2SpecificFields(vcJsonObject);
          this.validateCommonFields(vcJsonObject);
          
          const isExpiredV2 = vcJsonObject[CredentialValidatorConstants.VALID_UNTIL] && DateUtils.isVCExpired(vcJsonObject[CredentialValidatorConstants.VALID_UNTIL]);
          
          const expirationMessageV2 = isExpiredV2 ? CredentialValidatorConstants.ERROR_MESSAGE_VC_EXPIRED : '';
          const verificationStatusCodeV2 = isExpiredV2 ? CredentialValidatorConstants.ERROR_CODE_VC_EXPIRED : '';
          
          return new ValidationStatus(expirationMessageV2, verificationStatusCodeV2);
        }
        default:
          // CHANGE: Now throws an exception instead of returning a status.
          throw new ValidationException(
            CredentialValidatorConstants.ERROR_MESSAGE_CONTEXT_FIRST_LINE,
            `${CredentialValidatorConstants.ERROR_CODE_INVALID}${CredentialValidatorConstants.CONTEXT.toUpperCase()}`
          );
      }

    } catch (e: any) {
      // CHANGE: This catch block now handles all thrown exceptions, just like Kotlin.
      if (e instanceof ValidationException) {
        // It's a known validation error we threw on purpose.
        return new ValidationStatus(e.errorMessage, e.errorCode);
      } else {
        // It's an unexpected error (e.g., JSON.parse failed).
        return new ValidationStatus(
          `${CredentialValidatorConstants.EXCEPTION_DURING_VALIDATION}${e.message}`,
          CredentialValidatorConstants.ERROR_CODE_GENERIC
        );
      }
    }
  }

  /**
   * Validation for Data Model 1.1 - matches Kotlin exactly
   */
  private validateV1SpecificFields(vcJsonObject: any): void {
    const v1SpecificMandatoryFields = [
      CredentialValidatorConstants.ISSUANCE_DATE
    ];

    this.validationHelper.checkMandatoryFields(
      vcJsonObject,
      [...this.commonMandatoryFields, ...v1SpecificMandatoryFields]
    );

    // Assumes DateUtils methods are static.
    DateUtils.validateV1DateFields(vcJsonObject);

    const v1SpecificIdMandatoryFields = [
      CredentialValidatorConstants.CREDENTIAL_STATUS,
      CredentialValidatorConstants.REFRESH_SERVICE,
      CredentialValidatorConstants.CREDENTIAL_SCHEMA
    ];

    this.allFieldsWithIDAndType.forEach(field => {
      // Using Object.hasOwn is slightly safer than hasOwnProperty
      if (Object.hasOwnProperty(field)) {
        this.validationHelper.validateFieldsByIdAndType(
          vcJsonObject,
          field,
          v1SpecificIdMandatoryFields
        );
      }
    });
  }

  /**
   * Validation for Data Model 2.0 - matches Kotlin exactly
   */
  private validateV2SpecificFields(vcJsonObject: any): void {
    this.validationHelper.checkMandatoryFields(vcJsonObject, this.commonMandatoryFields);

    // Assumes DateUtils methods are static.
    DateUtils.validateV2DateFields(vcJsonObject);

    const v2SpecificIdMandatoryFields = [
      CredentialValidatorConstants.CREDENTIAL_SCHEMA
    ];

    this.allFieldsWithIDAndType.forEach(field => {
      if (Object.hasOwnProperty(field)) {
        this.validationHelper.validateFieldsByIdAndType(
          vcJsonObject,
          field,
          v2SpecificIdMandatoryFields
        );
      }
    });

    this.validationHelper.validateNameAndDescription(vcJsonObject);
  }

  /**
   * Common Validations 
   */
  private validateCommonFields(vcJsonObject: any): void {
    this.validationHelper.validateCredentialSubject(vcJsonObject);
    this.validationHelper.validateProof(JSON.stringify(vcJsonObject));
    this.validationHelper.validateId(vcJsonObject);
    this.validationHelper.validateType(vcJsonObject);
    this.validationHelper.validateIssuer(vcJsonObject);
  }
}
