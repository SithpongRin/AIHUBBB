/**
 * Shared retry helper for AI provider API requests.
 * Handles HTTP 429 (rate limit / quota) and 5xx errors with exponential backoff & jitter.
 * Respects Retry-After header.
 * Fails fast on 400, 401, 403, 404 (non-retriable).
 * Supports cancelable AbortController signals.
 * Sanitizes all error messages to ensure API keys are NEVER exposed.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

export class FatalProviderError extends Error {
  public statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(sanitizeMessage(message));
    this.name = 'FatalProviderError';
    this.statusCode = statusCode;
  }
}

export class RetriableProviderError extends Error {
  public statusCode?: number;
  public retryAfterMs?: number;
  constructor(message: string, statusCode?: number, retryAfterMs?: number) {
    super(sanitizeMessage(message));
    this.name = 'RetriableProviderError';
    this.statusCode = statusCode;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Remove sensitive credentials (API keys, auth headers) from error messages.
 */
export function sanitizeMessage(msg: string): string {
  if (!msg) return '';
  return msg
    .replace(/(?:gsk_|sk-ant-|sk-or-|sk-proj-|sk-|AIza|xai-)[A-Za-z0-9_-]{10,}/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/key=[A-Za-z0-9._-]+/gi, 'key=[REDACTED]');
}

/**
 * Parses HTTP Retry-After header which can be in seconds or an HTTP-date.
 */
export function parseRetryAfter(header: string | null | undefined): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  const seconds = parseFloat(trimmed);
  if (!isNaN(seconds) && seconds > 0) {
    return Math.round(seconds * 1000);
  }
  const parsedDate = Date.parse(trimmed);
  if (!isNaN(parsedDate)) {
    return Math.max(0, parsedDate - Date.now());
  }
  return null;
}

/**
 * Cancelable sleep respecting AbortSignal.
 */
export function sleepCancelable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Request was cancelled.', 'AbortError'));
    }

    const timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Request was cancelled.', 'AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort);
    }
  });
}

/**
 * Wrap an arbitrary async task with exponential backoff retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 2000;
  const maxDelayMs = options.maxDelayMs ?? 20000;
  const signal = options.signal;

  let attempt = 0;
  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Request was cancelled.', 'AbortError');
    }

    try {
      return await fn();
    } catch (err: unknown) {
      if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw new DOMException('Request was cancelled.', 'AbortError');
      }

      if (err instanceof FatalProviderError) {
        throw err;
      }

      let isRetriable = false;
      let retryAfterMs: number | null = null;

      if (err instanceof RetriableProviderError) {
        isRetriable = true;
        retryAfterMs = err.retryAfterMs ?? null;
      } else if (err instanceof TypeError) {
        // Network or fetch connection drop
        isRetriable = true;
      } else if (typeof err === 'object' && err !== null && 'status' in err) {
        const status = Number((err as { status: unknown }).status);
        if (status === 429 || status >= 500) {
          isRetriable = true;
        }
      }

      if (!isRetriable || attempt >= maxRetries) {
        throw err;
      }

      attempt++;

      // Exponential backoff: 2s, 4s, 8s with random jitter, capped at maxDelayMs
      let delayMs: number;
      if (retryAfterMs !== null && retryAfterMs > 0) {
        delayMs = Math.min(retryAfterMs, maxDelayMs);
      } else {
        const exp = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 500;
        delayMs = Math.min(exp + jitter, maxDelayMs);
      }

      if (options.onRetry) {
        options.onRetry(attempt, delayMs, err);
      }

      await sleepCancelable(delayMs, signal);
    }
  }
}

/**
 * Helper to fetch with automatic 429 / 5xx retry and 400-404 fast-failure.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const signal = options.signal || (init?.signal as AbortSignal | undefined);

  return withRetry(async () => {
    const response = await fetch(url, {
      ...init,
      signal,
    });

    if (response.ok) {
      return response;
    }

    const status = response.status;

    // Retry on 429 and 5xx
    if (status === 429 || status >= 500) {
      const retryAfter = response.headers.get('retry-after');
      const retryAfterMs = parseRetryAfter(retryAfter) ?? undefined;
      let errDetail = '';
      try {
        const text = await response.text();
        errDetail = text;
      } catch {
        // ignore
      }
      throw new RetriableProviderError(
        `Provider rate limit or server error (${status}): ${errDetail || response.statusText}`,
        status,
        retryAfterMs
      );
    }

    // Do NOT retry on 400, 401, 403, 404
    let errBody = '';
    try {
      const errData = await response.json();
      errBody = errData?.error?.message || errData?.message || JSON.stringify(errData);
    } catch {
      try {
        errBody = await response.text();
      } catch {
        // ignore
      }
    }

    if (status === 401) {
      throw new FatalProviderError('Authentication failed. Please verify your API key in Settings.', 401);
    }
    if (status === 404) {
      throw new FatalProviderError(
        `Model not found or unavailable on this account (${errBody || response.statusText}). Please choose another model in Settings.`,
        404
      );
    }
    if (status === 403) {
      throw new FatalProviderError(`Access forbidden (${errBody || response.statusText}). Verify API permissions.`, 403);
    }
    if (status === 400) {
      throw new FatalProviderError(`Invalid request: ${errBody || response.statusText}`, 400);
    }

    throw new FatalProviderError(`Request failed with status ${status}: ${errBody || response.statusText}`, status);
  }, { ...options, signal });
}
