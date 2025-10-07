// @ts-ignore - the zxing-wasm package does not publish type declarations for the full bundle exports
import { prepareZXingModule } from 'zxing-wasm/full';

type PrepareOptions = NonNullable<Parameters<typeof prepareZXingModule>[0]>;
type ZXingModuleOverrides = NonNullable<PrepareOptions['overrides']>;

interface WarmUpOptions {
  /**
   * A custom base URL where the .wasm assets are served from.
   * If provided, the loader will rewrite locateFile calls so that
   * `zxing_full.wasm` (and friends) are fetched from this location.
   */
  baseUrl?: string;
  /**
   * Advanced: override any of the ZXing module attributes directly.
   * When supplied, you're responsible for ensuring locateFile is handled.
   */
  overrides?: ZXingModuleOverrides;
  /**
   * If false, the module won't be instantiated immediately. Defaults to true.
   */
  fireImmediately?: boolean;
}

type PrepareResult = void | Promise<unknown> | PromiseLike<unknown>;

let warmUpPromise: Promise<void> | null = null;

const sanitizeBaseUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  return url.replace(/\/?$/, '');
};

const resolveBaseUrlFromEnv = (): string | undefined => {
  const globalObj: Record<string, unknown> = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {};
  const envProcess = typeof globalObj.process === 'object' ? (globalObj.process as { env?: Record<string, string> }) : undefined;
  const processEnvBase = envProcess?.env?.ZXING_WASM_BASE_URL ?? envProcess?.env?.VITE_ZXING_WASM_BASE_URL;

  const importMetaBase = (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
      return metaEnv?.ZXING_WASM_BASE_URL ?? metaEnv?.VITE_ZXING_WASM_BASE_URL;
    } catch {
      return undefined;
    }
  })();

  const globalBase = typeof globalObj.ZXING_WASM_BASE_URL === 'string' ? (globalObj.ZXING_WASM_BASE_URL as string) : undefined;

  const base = processEnvBase ?? importMetaBase ?? globalBase;
  return sanitizeBaseUrl(base);
};

const buildOverrides = (
  explicitOverrides?: ZXingModuleOverrides,
  baseUrl?: string,
): ZXingModuleOverrides | undefined => {
  if (explicitOverrides) {
    return explicitOverrides;
  }

  const url = sanitizeBaseUrl(baseUrl ?? resolveBaseUrlFromEnv());
  if (!url) return undefined;

  return {
    locateFile: (path: string, prefix: string) => {
      if (path.slice(-5) === '.wasm') {
        return `${url}/${path}`;
      }
      return `${prefix ?? ''}${path}`;
    },
  };
};

const ensurePromise = (value: PrepareResult): Promise<void> => {
  if (value && typeof (value as PromiseLike<unknown>).then === 'function') {
    return (value as PromiseLike<unknown>).then(() => undefined) as Promise<void>;
  }

  return Promise.resolve();
};

/**
 * Warm up the ZXing WASM module so that barcode reads are instant when the scanner is shown.
 * Calling this multiple times reuses the same in-flight promise.
 */
export const warmUpZXingModule = (options?: WarmUpOptions): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (warmUpPromise) {
    return warmUpPromise;
  }

  const overrides = buildOverrides(options?.overrides, options?.baseUrl);
  const shouldFireImmediately = options?.fireImmediately ?? true;

  const result = prepareZXingModule({
    overrides,
    fireImmediately: shouldFireImmediately,
  } as PrepareOptions) as PrepareResult;

  warmUpPromise = ensurePromise(result).catch((error: unknown) => {
    warmUpPromise = null;
    throw error;
  });

  return warmUpPromise;
};

/**
 * Allows clearing the cached promise, primarily intended for testing.
 */
export const resetZXingWarmUp = (): void => {
  warmUpPromise = null;
};
