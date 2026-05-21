import { redactApiKey } from "../security/redact.js";

// ─── Error Types ─────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
  ) {
    super(redactApiKey(message));
    this.name = "AppError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Geçersiz API anahtarı. Lütfen --reset-key ile anahtarınızı güncelleyin.") {
    super(message, "AUTH_ERROR", false);
    this.name = "AuthError";
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    const msg = retryAfter
      ? `İstek limiti aşıldı. ${retryAfter} saniye sonra tekrar deneyin.`
      : "İstek limiti aşıldı. Lütfen bir süre bekleyin.";
    super(msg, "RATE_LIMIT", true);
    this.name = "RateLimitError";
  }
}

export class ModelNotFoundError extends AppError {
  constructor(modelId: string) {
    super(`Model bulunamadı: ${modelId}`, "MODEL_NOT_FOUND", false);
    this.name = "ModelNotFoundError";
  }
}

export class NetworkError extends AppError {
  constructor(message = "Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.") {
    super(message, "NETWORK_ERROR", true);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends AppError {
  constructor() {
    super("İstek zaman aşımına uğradı. Lütfen tekrar deneyin.", "TIMEOUT", true);
    this.name = "TimeoutError";
  }
}

export class ParseError extends AppError {
  constructor(message = "Sunucudan geçersiz yanıt alındı.") {
    super(message, "PARSE_ERROR", false);
    this.name = "ParseError";
  }
}

export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR", false);
    this.name = "ConfigError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", false);
    this.name = "ValidationError";
  }
}

// ─── HTTP Error Mapper ────────────────────────────────────────────────────────

export function mapHttpError(status: number, body?: string): AppError {
  switch (status) {
    case 401:
      return new AuthError();
    case 403:
      return new AuthError("Erişim reddedildi. API anahtarınızın yetkilerini kontrol edin.");
    case 404:
      return new ModelNotFoundError("bilinmeyen");
    case 429: {
      const retryAfter = parseRetryAfter(body);
      return new RateLimitError(retryAfter);
    }
    case 500:
    case 502:
    case 503:
    case 504:
      return new AppError(
        "OpenRouter sunucusunda geçici bir hata oluştu. Lütfen tekrar deneyin.",
        "SERVER_ERROR",
        true,
      );
    default:
      return new AppError(
        `Beklenmeyen HTTP hatası: ${status}`,
        "HTTP_ERROR",
        status >= 500,
      );
  }
}

function parseRetryAfter(body?: string): number | undefined {
  if (!body) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "retry_after" in parsed &&
      typeof (parsed as Record<string, unknown>)["retry_after"] === "number"
    ) {
      return (parsed as Record<string, number>)["retry_after"];
    }
  } catch {
    // ignore parse errors
  }
  return undefined;
}

// ─── User-Friendly Message ────────────────────────────────────────────────────

export function toUserMessage(err: unknown): string {
  if (err instanceof AppError) {
    return err.message;
  }
  if (err instanceof Error) {
    const msg = redactApiKey(err.message);
    if (msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
      return "Ağ bağlantısı kurulamadı. İnternet bağlantınızı kontrol edin.";
    }
    if (msg.includes("ETIMEDOUT") || msg.includes("UND_ERR_CONNECT_TIMEOUT")) {
      return "Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.";
    }
    return `Hata: ${msg}`;
  }
  return "Bilinmeyen bir hata oluştu.";
}
