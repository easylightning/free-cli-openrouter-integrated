import { describe, it, expect } from "vitest";
import { redactApiKey, redactHeaders, looksLikeApiKey } from "../src/security/redact.js";

// ─── Redaction Tests ──────────────────────────────────────────────────────────

describe("redactApiKey", () => {
  const REAL_KEY = "sk-or-v1-abc123def456ghi789jkl012mno345pqr678";

  it("redacts a full OpenRouter API key", () => {
    const result = redactApiKey(`My key is ${REAL_KEY}`);
    expect(result).not.toContain(REAL_KEY);
    expect(result).toContain("[REDACTED]");
  });

  it("redacts key in Bearer authorization header value", () => {
    const result = redactApiKey(`Authorization: Bearer ${REAL_KEY}`);
    expect(result).not.toContain(REAL_KEY);
    expect(result).toContain("[REDACTED]");
  });

  it("redacts multiple keys in one string", () => {
    const result = redactApiKey(`key1=${REAL_KEY} key2=${REAL_KEY}`);
    expect(result).not.toContain(REAL_KEY);
    const count = (result.match(/\[REDACTED\]/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("does not modify strings without API keys", () => {
    const safe = "Hello, world! This is a normal string.";
    expect(redactApiKey(safe)).toBe(safe);
  });

  it("redacts key embedded in error message", () => {
    const errorMsg = `Failed to authenticate with key sk-or-v1-supersecretkey12345678901234567890`;
    const result = redactApiKey(errorMsg);
    expect(result).not.toContain("supersecretkey");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts generic sk- prefixed keys", () => {
    const result = redactApiKey("key=sk-abcdefghijklmnopqrstuvwxyz1234567890");
    expect(result).toContain("[REDACTED]");
  });

  it("handles empty string", () => {
    expect(redactApiKey("")).toBe("");
  });

  it("handles string with only the key", () => {
    const result = redactApiKey(REAL_KEY);
    expect(result).toBe("[REDACTED]");
  });

  it("preserves surrounding text while redacting key", () => {
    const result = redactApiKey(`Error: invalid key ${REAL_KEY} provided`);
    expect(result).toContain("Error: invalid key");
    expect(result).toContain("provided");
    expect(result).not.toContain(REAL_KEY);
  });
});

describe("redactHeaders", () => {
  it("redacts Authorization header", () => {
    const headers = {
      Authorization: "Bearer sk-or-v1-abc123def456ghi789jkl012mno345pqr678",
      "Content-Type": "application/json",
    };
    const result = redactHeaders(headers);
    expect(result["Authorization"]).toBe("Bearer [REDACTED]");
    expect(result["Content-Type"]).toBe("application/json");
  });

  it("is case-insensitive for authorization header", () => {
    const headers = { authorization: "Bearer sk-or-v1-abc123def456ghi789" };
    const result = redactHeaders(headers);
    expect(result["authorization"]).toBe("Bearer [REDACTED]");
  });

  it("redacts keys in other header values too", () => {
    const headers = { "X-Custom": "sk-or-v1-abc123def456ghi789jkl012mno345pqr678" };
    const result = redactHeaders(headers);
    expect(result["X-Custom"]).toBe("[REDACTED]");
  });
});

describe("looksLikeApiKey", () => {
  it("returns true for valid OpenRouter key format", () => {
    expect(looksLikeApiKey("sk-or-v1-abc123def456ghi789jkl012mno345pqr678")).toBe(true);
  });

  it("returns false for too-short key", () => {
    expect(looksLikeApiKey("sk-or-v1-short")).toBe(false);
  });

  it("returns false for wrong prefix", () => {
    expect(looksLikeApiKey("sk-openai-abc123def456ghi789jkl012mno345pqr678")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(looksLikeApiKey("")).toBe(false);
  });

  it("returns false for random string", () => {
    expect(looksLikeApiKey("not-an-api-key")).toBe(false);
  });

  it("trims whitespace before checking", () => {
    expect(looksLikeApiKey("  sk-or-v1-abc123def456ghi789jkl012mno345pqr678  ")).toBe(true);
  });
});
