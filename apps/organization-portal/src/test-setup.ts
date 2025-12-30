// Test setup for organization-portal
import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock IDBRequest and related IndexedDB types
class MockIDBRequest {
  result: any = {};
  error: any = null;
  onsuccess: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  readyState: string = 'done';
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

class MockIDBDatabase {
  name = 'test-db';
  version = 1;
  objectStoreNames = {
    contains: vi.fn(() => false),
  };
  createObjectStore = vi.fn(() => ({
    createIndex: vi.fn(),
  }));
  transaction = vi.fn(() => ({
    objectStore: vi.fn(() => ({
      add: vi.fn(() => new MockIDBRequest()),
      get: vi.fn(() => new MockIDBRequest()),
      put: vi.fn(() => new MockIDBRequest()),
      delete: vi.fn(() => new MockIDBRequest()),
      clear: vi.fn(() => new MockIDBRequest()),
      getAll: vi.fn(() => new MockIDBRequest()),
    })),
  }));
  close = vi.fn();
}

// Mock IndexedDB globals
Object.defineProperty(globalThis, 'IDBRequest', {
  value: MockIDBRequest,
  writable: true,
});

Object.defineProperty(globalThis, 'IDBDatabase', {
  value: MockIDBDatabase,
  writable: true,
});

Object.defineProperty(globalThis, 'indexedDB', {
  value: {
    open: vi.fn(() => {
      const request = new MockIDBRequest();
      setTimeout(() => {
        request.result = new MockIDBDatabase();
        if (request.onsuccess) request.onsuccess({ target: request } as any);
      }, 0);
      return request;
    }),
    deleteDatabase: vi.fn(() => new MockIDBRequest()),
  },
  writable: true,
});

Object.defineProperty(globalThis, 'IDBKeyRange', {
  value: {
    bound: vi.fn(),
    only: vi.fn(),
    lowerBound: vi.fn(),
    upperBound: vi.fn(),
  },
  writable: true,
});

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  debug: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};