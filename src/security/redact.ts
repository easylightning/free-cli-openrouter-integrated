// ─── API Key Redaction ────────────────────────────────────────────────────────
// Masks any string that looks like an OpenRouter API key (sk-or-v1-...)
// This helper must be used in ALL error messages, logs, and outputs.

const API_KEY_PATTERN = /sk-or-v1-[a-zA-Z0-9_-]{8,}/g;
const BEARER_PATTERN = /Bearer\s+sk-or-v1-[a-zA-Z0-9_-]{8,}/gi;
const GENERIC_KEY_PATTERN = /sk-[a-zA-Z0-9_-]{20,}/g;

const REDACTED = "[REDACTED]";

/**
 * Replaces any API key-like strings in the input with [REDACTED].
 * Safe to call with any string, including undefined/null (returns empty string).
 */
export function redactApiKey(input: string): string {
  return input
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(API_KEY_PATTERN, REDACTED)
    .replace(GENERIC_KEY_PATTERN, REDACTED);
}

/**
 * Redacts API keys from an object's string values (shallow).
 * Useful for sanitizing headers before logging.
 */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "authorization") {
      result[key] = `Bearer ${REDACTED}`;
    } else {
      result[key] = redactApiKey(value);
    }
  }
  return result;
}

/**
 * Checks whether a string looks like a valid OpenRouter API key format.
 */
export function looksLikeApiKey(value: string): boolean {
  return /^sk-or-v1-[a-zA-Z0-9_-]{20,}$/.test(value.trim());
}
