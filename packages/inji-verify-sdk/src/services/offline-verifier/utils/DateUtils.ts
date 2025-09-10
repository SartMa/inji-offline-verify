import { CredentialValidatorConstants } from '../constants/CredentialValidatorConstants.js';

/**
 * Validation Exception interface
 */
interface ValidationException {
  errorMessage: string;
  errorCode: string;
}

/**
 * DateUtils class - matches Kotlin DateUtils functionality
 */
export class DateUtils {
  private static readonly DATE_FORMATS = [
    'yyyy-MM-ddTHH:mm:ss.SSSZ',
    'yyyy-MM-ddTHH:mm:ssZ'
  ];

  private static readonly UTC = 'UTC';

  /**
   * Check if date string matches valid format using regex
   * @param dateValue - Date string to validate
   * @returns true if valid format
   */
  static isValidDate(dateValue: string): boolean {
    return CredentialValidatorConstants.DATE_REGEX.test(dateValue);
  }

  /**
   * Parse date string to Date object
   * @param dateString - Date string to parse
   * @returns Date object or null if parsing fails
   */
  static parseDate(dateString: string): Date | null {
    try {
      // Try ISO 8601 parsing first
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (error) {
      // Continue to try other formats
    }

    // Try different format patterns
    for (const format of this.DATE_FORMATS) {
      try {
        const date = this.parseWithFormat(dateString, format);
        if (date) {
          return date;
        }
      } catch (error) {
        // Continue to next format
      }
    }

    return null;
  }

  /**
   * Validate V1.1 specific date fields
   * @param vcJsonObject - Credential object
   * @throws ValidationException if validation fails
   */
  static validateV1DateFields(vcJsonObject: any): void {
    const dateValidations: Array<[string, string]> = [
      [CredentialValidatorConstants.ISSUANCE_DATE, CredentialValidatorConstants.ERROR_ISSUANCE_DATE_INVALID],
      [CredentialValidatorConstants.EXPIRATION_DATE, CredentialValidatorConstants.ERROR_EXPIRATION_DATE_INVALID]
    ];

    dateValidations.forEach(([dateKey, errorMessage]) => {
      if (vcJsonObject.hasOwnProperty(dateKey) && !this.isValidDate(vcJsonObject[dateKey].toString())) {
        throw {
          errorMessage: errorMessage,
          errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${dateKey.toUpperCase()}`
        } as ValidationException;
      }
    });

    const issuanceDate = vcJsonObject[CredentialValidatorConstants.ISSUANCE_DATE] || '';

    if (this.isFutureDateWithTolerance(issuanceDate)) {
      throw {
        errorMessage: CredentialValidatorConstants.ERROR_CURRENT_DATE_BEFORE_ISSUANCE_DATE,
        errorCode: CredentialValidatorConstants.ERROR_CODE_CURRENT_DATE_BEFORE_ISSUANCE_DATE
      } as ValidationException;
    }
  }

  /**
   * Validate V2.0 specific date fields
   * @param vcJsonObject - Credential object
   * @throws ValidationException if validation fails
   */
  static validateV2DateFields(vcJsonObject: any): void {
    const dateValidations: Array<[string, string]> = [
      [CredentialValidatorConstants.VALID_FROM, CredentialValidatorConstants.ERROR_VALID_FROM_INVALID],
      [CredentialValidatorConstants.VALID_UNTIL, CredentialValidatorConstants.ERROR_VALID_UNTIL_INVALID]
    ];

    dateValidations.forEach(([dateKey, errorMessage]) => {
      if (vcJsonObject.hasOwnProperty(dateKey) && !this.isValidDate(vcJsonObject[dateKey].toString())) {
        throw {
          errorMessage: errorMessage,
          errorCode: `${CredentialValidatorConstants.ERROR_CODE_INVALID}${dateKey.toUpperCase()}`
        } as ValidationException;
      }
    });

    if (vcJsonObject.hasOwnProperty(CredentialValidatorConstants.VALID_FROM) && 
        this.isFutureDateWithTolerance(vcJsonObject[CredentialValidatorConstants.VALID_FROM])) {
      throw {
        errorMessage: CredentialValidatorConstants.ERROR_CURRENT_DATE_BEFORE_VALID_FROM,
        errorCode: CredentialValidatorConstants.ERROR_CODE_CURRENT_DATE_BEFORE_VALID_FROM
      } as ValidationException;
    }
  }

  /**
   * Check if credential is expired
   * @param inputDate - Date string to check
   * @returns true if expired
   */
  static isVCExpired(inputDate: string): boolean {
    return inputDate.length > 0 && !this.isFutureDateWithTolerance(inputDate);
  }

  /**
   * Check if date is in the future with tolerance
   * @param inputDateString - Date string to check
   * @param toleranceInMilliSeconds - Tolerance in milliseconds (default 3000)
   * @returns true if date is in future (beyond tolerance)
   */
  static isFutureDateWithTolerance(inputDateString: string, toleranceInMilliSeconds: number = 3000): boolean {
    const inputDate = this.parseDate(inputDateString);
    if (!inputDate) {
      console.error('Given date is not available in supported date formats');
      return false;
    }

    const currentTime = Date.now();
    const inputDateTime = inputDate.getTime();
    const upperBound = currentTime + toleranceInMilliSeconds;

    return inputDateTime > upperBound;
  }

  // --- Private Helper Methods ---

  private static parseWithFormat(dateString: string, format: string): Date | null {
    // This is a simplified implementation
    // For production, you might want to use a library like date-fns or moment.js
    
    try {
      // Handle common ISO 8601 formats
      if (format.includes('SSS')) {
        // With milliseconds
        const isoRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z?$/;
        const match = dateString.match(isoRegex);
        if (match) {
          const [, year, month, day, hour, minute, second, millisecond] = match;
          return new Date(Date.UTC(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute),
            parseInt(second),
            parseInt(millisecond)
          ));
        }
      } else {
        // Without milliseconds
        const isoRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z?$/;
        const match = dateString.match(isoRegex);
        if (match) {
          const [, year, month, day, hour, minute, second] = match;
          return new Date(Date.UTC(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute),
            parseInt(second)
          ));
        }
      }
    } catch (error) {
      return null;
    }

    return null;
  }
}