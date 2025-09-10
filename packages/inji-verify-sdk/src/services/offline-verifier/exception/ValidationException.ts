import { BaseUncheckedException } from './BaseUncheckedException.js';

/**
 * Validation Exception class - matches Kotlin ValidationException exactly
 */
export class ValidationException extends BaseUncheckedException {
  public readonly errorMessage: string;
  public readonly errorCode: string;

  constructor(errorMessage: string, errorCode: string) {
    super(errorMessage);
    this.errorMessage = errorMessage;
    this.errorCode = errorCode;
  }

  /**
   * Override toString to match Kotlin behavior
   */
  toString(): string {
    return `ValidationException: ${this.errorMessage} (Code: ${this.errorCode})`;
  }

  /**
   * Get error details as object (useful for JSON serialization)
   */
  toErrorObject(): { message: string; code: string; type: string } {
    return {
      message: this.errorMessage,
      code: this.errorCode,
      type: 'ValidationException'
    };
  }
}