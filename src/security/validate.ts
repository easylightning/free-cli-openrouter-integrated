import { resolve, normalize, isAbsolute } from "node:path";
import { ValidationError } from "../utils/errors.js";
import { looksLikeApiKey } from "./redact.js";

// ─── Input Validation ─────────────────────────────────────────────────────────

/**
 * Validates and normalizes a user-provided file path for /save command.
 * Prevents path traversal attacks.
 */
export function validateSavePath(userInput: string, allowedBaseDir?: string): string {
  if (!userInput || userInput.trim().length === 0) {
    throw new ValidationError("Dosya yolu boş olamaz.");
  }

  const trimmed = userInput.trim();

  // Reject null bytes
  if (trimmed.includes("\0")) {
    throw new ValidationError("Geçersiz dosya yolu: null byte içeriyor.");
  }

  // Resolve to absolute path
  const resolved = isAbsolute(trimmed) ? normalize(trimmed) : resolve(process.cwd(), trimmed);

  // If a base directory is specified, ensure the path stays within it
  if (allowedBaseDir) {
    const base = resolve(allowedBaseDir);
    if (!resolved.startsWith(base + "/") && resolved !== base) {
      throw new ValidationError(
        `Güvenlik hatası: Dosya yolu izin verilen dizin dışında: ${resolved}`,
      );
    }
  }

  // Reject paths with suspicious patterns
  if (resolved.includes("..")) {
    throw new ValidationError("Güvenlik hatası: Üst dizin referansı (..) kabul edilmez.");
  }

  return resolved;
}

/**
 * Validates an API key format.
 */
export function validateApiKey(key: string): string {
  const trimmed = key.trim();

  if (!trimmed) {
    throw new ValidationError("API anahtarı boş olamaz.");
  }

  if (!looksLikeApiKey(trimmed)) {
    throw new ValidationError(
      "Geçersiz API anahtarı formatı. Anahtar 'sk-or-v1-' ile başlamalıdır.",
    );
  }

  return trimmed;
}

/**
 * Validates a model ID to prevent injection.
 */
export function validateModelId(modelId: string): string {
  const trimmed = modelId.trim();

  if (!trimmed) {
    throw new ValidationError("Model ID boş olamaz.");
  }

  // Model IDs are alphanumeric with slashes, hyphens, dots, colons
  if (!/^[a-zA-Z0-9/_\-.:]+$/.test(trimmed)) {
    throw new ValidationError(`Geçersiz model ID formatı: ${trimmed}`);
  }

  if (trimmed.length > 200) {
    throw new ValidationError("Model ID çok uzun.");
  }

  return trimmed;
}

/**
 * Validates user chat input.
 */
export function validateChatInput(input: string): string {
  if (!input || input.trim().length === 0) {
    throw new ValidationError("Mesaj boş olamaz.");
  }

  // Limit message size to prevent memory issues (100KB)
  const MAX_INPUT_BYTES = 100 * 1024;
  if (Buffer.byteLength(input, "utf8") > MAX_INPUT_BYTES) {
    throw new ValidationError(
      `Mesaj çok uzun. Maksimum ${MAX_INPUT_BYTES / 1024}KB izin verilir.`,
    );
  }

  return input.trim();
}
