import { BaseUncheckedException } from './BaseUncheckedException.js';

/**
 * Unknown Exception class - matches Kotlin UnknownException exactly
 */
export class UnknownException extends BaseUncheckedException {
  constructor(message?: string) {
    super(message || 'An unknown error occurred');
  }

  /**
   * Override toString to match Kotlin behavior
   */
  toString(): string {
    return `UnknownException: ${this.message}`;
  }

  /**
   * Get error details as object (useful for JSON serialization)
   */
  toErrorObject(): { message: string; type: string } {
    return {
      message: this.message || 'Unknown error',
      type: 'UnknownException'
    };
  }
}