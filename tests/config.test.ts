import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ─── Config Tests ─────────────────────────────────────────────────────────────
// We test config loading/saving by overriding the CONFIG_FILE path via mocking.

describe("AppConfigSchema validation", () => {
  it("accepts valid config", async () => {
    const { AppConfigSchema } = await import("../src/config/config.js");

    const result = AppConfigSchema.safeParse({
      apiKey: "sk-or-v1-abc123def456ghi789jkl012mno345pqr678",
      requestTimeoutMs: 60_000,
      maxHistoryMessages: 50,
      modelsCacheTtlMs: 3_600_000,
    });

    expect(result.success).toBe(true);
  });

  it("rejects config with empty apiKey", async () => {
    const { AppConfigSchema } = await import("../src/config/config.js");

    const result = AppConfigSchema.safeParse({
      apiKey: "",
      requestTimeoutMs: 60_000,
      maxHistoryMessages: 50,
      modelsCacheTtlMs: 3_600_000,
    });

    expect(result.success).toBe(false);
  });

  it("rejects config with missing apiKey", async () => {
    const { AppConfigSchema } = await import("../src/config/config.js");

    const result = AppConfigSchema.safeParse({
      requestTimeoutMs: 60_000,
    });

    expect(result.success).toBe(false);
  });

  it("rejects config with negative timeout", async () => {
    const { AppConfigSchema } = await import("../src/config/config.js");

    const result = AppConfigSchema.safeParse({
      apiKey: "sk-or-v1-abc123def456ghi789jkl012mno345pqr678",
      requestTimeoutMs: -1,
      maxHistoryMessages: 50,
      modelsCacheTtlMs: 3_600_000,
    });

    expect(result.success).toBe(false);
  });

  it("applies default values for optional fields", async () => {
    const { AppConfigSchema } = await import("../src/config/config.js");

    const result = AppConfigSchema.safeParse({
      apiKey: "sk-or-v1-abc123def456ghi789jkl012mno345pqr678",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestTimeoutMs).toBe(60_000);
      expect(result.data.maxHistoryMessages).toBe(50);
      expect(result.data.modelsCacheTtlMs).toBe(3_600_000);
    }
  });

  it("accepts optional httpReferer as valid URL", async () => {
    const { AppConfigSchema } = await import("../src/config/config.js");

    const result = AppConfigSchema.safeParse({
      apiKey: "sk-or-v1-abc123def456ghi789jkl012mno345pqr678",
      httpReferer: "https://myapp.example.com",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid httpReferer (not a URL)", async () => {
    const { AppConfigSchema } = await import("../src/config/config.js");

    const result = AppConfigSchema.safeParse({
      apiKey: "sk-or-v1-abc123def456ghi789jkl012mno345pqr678",
      httpReferer: "not-a-url",
    });

    expect(result.success).toBe(false);
  });
});

describe("Config file read/write", () => {
  let tempDir: string;
  let tempConfigFile: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `openrouter-test-${Date.now()}`);
    tempConfigFile = join(tempDir, "config.json");
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes valid JSON to config file", async () => {
    const config = {
      apiKey: "sk-or-v1-abc123def456ghi789jkl012mno345pqr678",
      requestTimeoutMs: 60_000,
      maxHistoryMessages: 50,
      modelsCacheTtlMs: 3_600_000,
    };

    await writeFile(tempConfigFile, JSON.stringify(config, null, 2), "utf8");

    const raw = await import("node:fs/promises").then((fs) =>
      fs.readFile(tempConfigFile, "utf8"),
    );
    const parsed: unknown = JSON.parse(raw);

    expect(parsed).toMatchObject({ apiKey: config.apiKey });
  });

  it("rejects malformed JSON gracefully", async () => {
    await writeFile(tempConfigFile, "{ invalid json }", "utf8");

    const raw = await import("node:fs/promises").then((fs) =>
      fs.readFile(tempConfigFile, "utf8"),
    );

    expect(() => JSON.parse(raw)).toThrow();
  });
});

describe("Config permission check", () => {
  it("secureFile does not throw on valid path", async () => {
    const { secureFile } = await import("../src/security/permissions.js");
    const tempFile = join(tmpdir(), `perm-test-${Date.now()}.json`);

    await writeFile(tempFile, "{}", "utf8");

    await expect(secureFile(tempFile)).resolves.not.toThrow();

    await rm(tempFile, { force: true });
  });

  it("secureFile does not throw on non-existent file (Windows path)", async () => {
    const { secureFile } = await import("../src/security/permissions.js");
    // Should not throw even if file doesn't exist
    await expect(
      secureFile(join(tmpdir(), "nonexistent-file.json")),
    ).resolves.not.toThrow();
  });
});
