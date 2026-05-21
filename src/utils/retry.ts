import { AppError } from "./errors.js";
import { logger } from "./logger.js";

// ─── Retry with Exponential Backoff ──────────────────────────────────────────

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  jitter: true,
};

/**
 * Executes an async operation with exponential backoff retry.
 * Only retries on errors marked as retryable.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      const isRetryable = err instanceof AppError ? err.retryable : true;

      if (!isRetryable || attempt === opts.maxAttempts) {
        throw err;
      }

      const delay = calculateDelay(attempt, opts);
      logger.debug(
        `Deneme ${attempt}/${opts.maxAttempts} başarısız. ${delay}ms sonra tekrar deneniyor...`,
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

function calculateDelay(attempt: number, opts: RetryOptions): number {
  // Exponential backoff: baseDelay * 2^(attempt-1)
  const exponential = opts.baseDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, opts.maxDelayMs);

  if (opts.jitter) {
    // Add ±25% jitter to avoid thundering herd
    const jitterRange = capped * 0.25;
    return Math.floor(capped + (Math.random() * 2 - 1) * jitterRange);
  }

  return capped;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
