import { fetch, Agent } from "undici";
import { redactApiKey } from "../security/redact.js";
import { mapHttpError, ParseError, NetworkError, TimeoutError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// ─── HTTP Client ──────────────────────────────────────────────────────────────

export const BASE_URL = "https://openrouter.ai/api/v1";
const APP_TITLE = "openrouter-free-cli";

// Reusable undici agent with connection pooling
const httpAgent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  connections: 10,
});

export interface RequestOptions {
  apiKey: string;
  timeoutMs?: number | undefined;
  httpReferer?: string | undefined;
}

/**
 * Makes an authenticated GET request to the OpenRouter API.
 */
export async function apiGet<T>(
  path: string,
  options: RequestOptions,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const timeoutMs = options.timeoutMs ?? 60_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logger.debug(`GET ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(options),
      signal: controller.signal,
      dispatcher: httpAgent,
    });

    clearTimeout(timer);

    const bodyText = await response.text();

    if (!response.ok) {
      throw mapHttpError(response.status, bodyText);
    }

    return parseJsonSafe<T>(bodyText);
  } catch (err) {
    clearTimeout(timer);
    return handleFetchError(err);
  }
}

/**
 * Makes an authenticated POST request and returns a streaming response body.
 */
export async function apiPostStream(
  path: string,
  body: unknown,
  options: RequestOptions,
): Promise<ReadableStream<Uint8Array>> {
  const url = `${BASE_URL}${path}`;
  const timeoutMs = options.timeoutMs ?? 60_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logger.debug(`POST ${url} (streaming)`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...buildHeaders(options),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      dispatcher: httpAgent,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const bodyText = await response.text();
      throw mapHttpError(response.status, bodyText);
    }

    if (!response.body) {
      throw new ParseError("Sunucudan boş yanıt alındı.");
    }

    return response.body;
  } catch (err) {
    clearTimeout(timer);
    return handleFetchError(err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildHeaders(options: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    "X-Title": APP_TITLE,
    "User-Agent": APP_TITLE,
  };

  if (options.httpReferer) {
    headers["HTTP-Referer"] = options.httpReferer;
  }

  return headers;
}

function parseJsonSafe<T>(text: string): T {
  if (!text || text.trim().length === 0) {
    throw new ParseError("Sunucudan boş yanıt alındı.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // Redact any potential keys from parse error context
    const preview = redactApiKey(text.slice(0, 100));
    throw new ParseError(`JSON ayrıştırma hatası. Yanıt başlangıcı: ${preview}`);
  }
}

function handleFetchError(err: unknown): never {
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.message.includes("aborted")) {
      throw new TimeoutError();
    }
    if (
      err.message.includes("ENOTFOUND") ||
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("ECONNRESET") ||
      err.message.includes("UND_ERR")
    ) {
      throw new NetworkError();
    }
    // Re-throw AppErrors as-is
    if ("code" in err) {
      throw err;
    }
    throw new NetworkError(redactApiKey(err.message));
  }
  throw new NetworkError();
}
