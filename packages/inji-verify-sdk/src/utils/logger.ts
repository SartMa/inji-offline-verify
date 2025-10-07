/*
 * Centralized SDK logger with production-aware suppression.
 * Logs are disabled by default when NODE_ENV/import.meta.env.MODE is "production".
 * Set SDK_ENABLE_LOGS=true (Node env or global flag) to re-enable verbose output.
 */

type LogMethod = (...args: unknown[]) => void;

type MaybeProcess = { env?: Record<string, unknown> } | undefined;

const noop: LogMethod = () => {};

const getGlobalProcess = (): MaybeProcess => {
  if (typeof globalThis === 'undefined') {
    return undefined;
  }
  const candidate = (globalThis as Record<string, unknown>).process;
  return typeof candidate === 'object' ? (candidate as MaybeProcess) : undefined;
};

const resolveImportMetaEnv = (): Record<string, unknown> | undefined => {
  try {
    // @ts-ignore - import.meta is only available in ESM-aware bundlers/runtime
    const meta = typeof import.meta !== 'undefined' ? (import.meta as Record<string, unknown>) : undefined;
    const env = meta?.env as Record<string, unknown> | undefined;
    return env;
  } catch {
    return undefined;
  }
};

const coerceBoolean = (value: unknown): boolean | undefined => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

const isLocalhost = (): boolean => {
  if (typeof window === 'undefined' || !window.location) {
    return false;
  }
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
};

const isLoggingEnabled = (): boolean => {
  const globalProcess = getGlobalProcess();
  const env = globalProcess?.env ?? {};
  const importMetaEnv = resolveImportMetaEnv() ?? {};

  const forceLogs = coerceBoolean(env.SDK_ENABLE_LOGS ?? importMetaEnv.SDK_ENABLE_LOGS ?? (globalThis as any)?.SDK_ENABLE_LOGS);
  if (forceLogs === true) {
    return true;
  }

  const forceDisable = coerceBoolean(env.SDK_DISABLE_LOGS ?? importMetaEnv.SDK_DISABLE_LOGS ?? (globalThis as any)?.SDK_DISABLE_LOGS);
  if (forceDisable === true) {
    return false;
  }

  const nodeEnv = typeof env.NODE_ENV === 'string' ? env.NODE_ENV : undefined;
  const importMetaMode = typeof importMetaEnv.MODE === 'string' ? (importMetaEnv.MODE as string) : undefined;
  const importMetaDev = coerceBoolean((importMetaEnv as Record<string, unknown>)?.DEV);
  const importMetaProd = coerceBoolean((importMetaEnv as Record<string, unknown>)?.PROD);

  const isProdEnv = nodeEnv === 'production' || importMetaMode === 'production' || importMetaProd === true;
  if (isProdEnv) {
    return false;
  }

  const isDevEnv = nodeEnv === 'development' || importMetaMode === 'development' || importMetaDev === true;
  if (isDevEnv) {
    return true;
  }

  if (isLocalhost()) {
    return true;
  }

  // Default to silent when environment cannot be determined.
  return false;
};

const createNoopConsole = (): Console => {
  const target = typeof console !== 'undefined' ? console : ({} as Console);
  return new Proxy(target, {
    get(_target, prop) {
      const original = (target as any)[prop as keyof Console];
      return typeof original === 'function' ? noop : original;
    },
  }) as Console;
};

const createScopedConsole = (base: Console, scope?: string): Console => {
  if (!scope) {
    return base;
  }
  const prefix = `[${scope}]`;
  return new Proxy(base, {
    get(target, prop) {
      const original = (target as any)[prop as keyof Console];
      if (typeof original !== 'function') {
        return original;
      }
      return (...args: unknown[]) => {
        if (args.length > 0 && typeof args[0] === 'string') {
          (original as LogMethod).apply(target, [`${prefix} ${args[0]}`, ...args.slice(1)]);
        } else {
          (original as LogMethod).apply(target, [prefix, ...args]);
        }
      };
    },
  }) as Console;
};

const baseLogger: Console = isLoggingEnabled() ? console : createNoopConsole();

export type SdkLogger = Console;

export const sdkLogger: SdkLogger = baseLogger;

export const createSdkLogger = (scope?: string): SdkLogger => createScopedConsole(baseLogger, scope);
