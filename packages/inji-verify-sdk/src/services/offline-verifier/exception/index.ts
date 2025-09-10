// === BASE EXCEPTION ===
export { BaseUncheckedException } from './BaseUncheckedException.js';

// === SPECIFIC EXCEPTIONS ===
export { ValidationException } from './ValidationException.js';
export { UnknownException } from './UnknownException.js';

// === TYPE EXPORTS (for TypeScript users) ===
export type { BaseUncheckedException as BaseUncheckedExceptionType } from './BaseUncheckedException.js';
export type { ValidationException as ValidationExceptionType } from './ValidationException.js';
export type { UnknownException as UnknownExceptionType } from './UnknownException.js';