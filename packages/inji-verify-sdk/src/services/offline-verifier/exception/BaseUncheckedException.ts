/**
 * Base exception class - equivalent to Kotlin BaseUncheckedException
 * Extends Error to provide stack trace and proper error handling in TypeScript
 */
export class BaseUncheckedException extends Error {
  constructor(message?: string) {
    super(message || 'An unknown error occurred');
    this.name = this.constructor.name;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}