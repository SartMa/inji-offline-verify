import { CredentialValidatorConstants } from '../../constants/CredentialValidatorConstants.js';
import { ValidationHelper } from '../../utils/ValidationHelper.js';
import { DateUtils } from '../../utils/DateUtils.js';
import { Util, DATA_MODEL } from '../../utils/Util.js';

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
  private util: Util;

  constructor() {
    this.validationHelper = new ValidationHelper();
    this.util = new Util();
  }

  /**
   * Main validation function - matches Kotlin signature exactly
   * @param credential - JSON string of the credential
   * @returns ValidationStatus object
   */
  validate(credential: string): ValidationStatus {
    try {
      if (!credential || credential.length === 0) {
        return new ValidationStatus(
          CredentialValidatorConstants.ERROR_MESSAGE_EMPTY_VC_JSON,
          CredentialValidatorConstants.ERROR_CODE_EMPTY_VC_JSON
        );
      }

      const vcJsonObject = JSON.parse(credential);

      const contextVersion = this.util.getContextVersion(vcJsonObject);
      if (!contextVersion) {
        return new ValidationStatus(
          `${CredentialValidatorConstants.ERROR_MISSING_REQUIRED_FIELDS}${CredentialValidatorConstants.CONTEXT}`,
          `${CredentialValidatorConstants.ERROR_CODE_MISSING}${CredentialValidatorConstants.CONTEXT.toUpperCase()}`
        );
      }

      switch (contextVersion) {
        case DATA_MODEL.DATA_MODEL_1_1:
          this.validateV1SpecificFields(vcJsonObject);
          this.validateCommonFields(vcJsonObject);
          
          const hasExpirationDate = vcJsonObject.hasOwnProperty(CredentialValidatorConstants.EXPIRATION_DATE);
          const isExpired = hasExpirationDate && DateUtils.isVCExpired(vcJsonObject[CredentialValidatorConstants.EXPIRATION_DATE]);
          
          const expirationMessage = isExpired ? CredentialValidatorConstants.ERROR_MESSAGE_VC_EXPIRED : '';
          const verificationStatusCode = isExpired ? CredentialValidatorConstants.ERROR_CODE_VC_EXPIRED : '';
          
          return new ValidationStatus(expirationMessage, verificationStatusCode);

        case DATA_MODEL.DATA_MODEL_2_0:
          this.validateV2SpecificFields(vcJsonObject);
          this.validateCommonFields(vcJsonObject);
          
          const hasValidUntil = vcJsonObject.hasOwnProperty(CredentialValidatorConstants.VALID_UNTIL);
          const isExpiredV2 = hasValidUntil && DateUtils.isVCExpired(vcJsonObject[CredentialValidatorConstants.VALID_UNTIL]);
          
          const expirationMessageV2 = isExpiredV2 ? CredentialValidatorConstants.ERROR_MESSAGE_VC_EXPIRED : '';
          const verificationStatusCodeV2 = isExpiredV2 ? CredentialValidatorConstants.ERROR_CODE_VC_EXPIRED : '';
          
          return new ValidationStatus(expirationMessageV2, verificationStatusCodeV2);

        default:
          return new ValidationStatus(
            CredentialValidatorConstants.ERROR_MESSAGE_CONTEXT_FIRST_LINE,
            `${CredentialValidatorConstants.ERROR_CODE_INVALID}${CredentialValidatorConstants.CONTEXT.toUpperCase()}`
          );
      }

    } catch (e: any) {
      if (e.errorMessage && e.errorCode) {
        // ValidationException
        return new ValidationStatus(e.errorMessage, e.errorCode);
      } else {
        // Generic exception
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

    DateUtils.validateV1DateFields(vcJsonObject);

    const v1SpecificIdMandatoryFields = [
      CredentialValidatorConstants.CREDENTIAL_STATUS,
      CredentialValidatorConstants.REFRESH_SERVICE,
      CredentialValidatorConstants.CREDENTIAL_SCHEMA
    ];

    this.allFieldsWithIDAndType.forEach(field => {
      if (vcJsonObject.hasOwnProperty(field)) {
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

    DateUtils.validateV2DateFields(vcJsonObject);

    const v2SpecificIdMandatoryFields = [
      CredentialValidatorConstants.CREDENTIAL_SCHEMA
    ];

    this.allFieldsWithIDAndType.forEach(field => {
      if (vcJsonObject.hasOwnProperty(field)) {
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