import envPaths from "env-paths";
import { join } from "node:path";

// ─── Config Paths ─────────────────────────────────────────────────────────────

const APP_NAME = "openrouter-free-cli";

const paths = envPaths(APP_NAME, { suffix: "" });

export const CONFIG_DIR = paths.config;
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");
export const MODELS_CACHE_FILE = join(CONFIG_DIR, "models-cache.json");

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigFile(): string {
  return CONFIG_FILE;
}

export function getModelsCacheFile(): string {
  return MODELS_CACHE_FILE;
}
