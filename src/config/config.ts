import { z } from "zod";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { CONFIG_FILE } from "./paths.js";
import { secureFile } from "../security/permissions.js";
import { ConfigError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// ─── Config Schema ────────────────────────────────────────────────────────────

export const AppConfigSchema = z.object({
  apiKey: z.string().min(1),
  defaultModel: z.string().optional(),
  httpReferer: z.string().url().optional(),
  requestTimeoutMs: z.number().int().positive().default(60_000),
  maxHistoryMessages: z.number().int().positive().default(50),
  modelsCacheTtlMs: z.number().int().positive().default(3_600_000), // 1 hour
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// ─── Config Manager ───────────────────────────────────────────────────────────

/**
 * Loads and validates the config file.
 * Throws ConfigError if the file is missing or invalid.
 */
export async function loadConfig(): Promise<AppConfig> {
  let raw: string;

  try {
    raw = await readFile(CONFIG_FILE, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new ConfigError(
        "Yapılandırma dosyası bulunamadı. Lütfen önce 'openrouter-free' komutunu çalıştırın.",
      );
    }
    throw new ConfigError(`Yapılandırma dosyası okunamadı: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigError(
      "Yapılandırma dosyası geçersiz JSON içeriyor. Dosyayı silin ve yeniden oluşturun.",
    );
  }

  const result = AppConfigSchema.safeParse(parsed);
  if (!result.success) {
    logger.debug("Config validation errors:", result.error.format());
    throw new ConfigError(
      "Yapılandırma dosyası geçersiz. Lütfen --reset-key ile yeniden yapılandırın.",
    );
  }

  return result.data;
}

/**
 * Saves the config to disk with secure permissions.
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  // Validate before saving
  const result = AppConfigSchema.safeParse(config);
  if (!result.success) {
    throw new ConfigError("Geçersiz yapılandırma kaydedilemez.");
  }

  const dir = dirname(CONFIG_FILE);
  await mkdir(dir, { recursive: true });

  const json = JSON.stringify(result.data, null, 2);
  await writeFile(CONFIG_FILE, json, { encoding: "utf8", mode: 0o600 });
  await secureFile(CONFIG_FILE);
}

/**
 * Updates specific fields in the config.
 */
export async function updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
  let existing: Partial<AppConfig> = {};

  try {
    existing = await loadConfig();
  } catch {
    // Config doesn't exist yet, start fresh
  }

  const merged = { ...existing, ...updates };
  const result = AppConfigSchema.safeParse(merged);

  if (!result.success) {
    throw new ConfigError("Güncellenmiş yapılandırma geçersiz.");
  }

  await saveConfig(result.data);
  return result.data;
}

/**
 * Checks whether a config file with an API key exists.
 */
export async function hasApiKey(): Promise<boolean> {
  try {
    const config = await loadConfig();
    return config.apiKey.length > 0;
  } catch {
    return false;
  }
}
