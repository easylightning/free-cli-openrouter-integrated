import { password } from "@inquirer/prompts";
import { validateApiKey } from "../security/validate.js";
import { updateConfig, hasApiKey } from "./config.js";
import { CONFIG_FILE } from "./paths.js";
import chalk from "chalk";

// ─── Secure API Key Storage ───────────────────────────────────────────────────

/**
 * Prompts the user for their API key securely (masked input).
 * Validates the format and saves to config.
 */
export async function promptAndSaveApiKey(): Promise<string> {
  console.log(chalk.cyan("\n🔑 OpenRouter API Anahtarı Kurulumu"));
  console.log(chalk.gray("  API anahtarınızı https://openrouter.ai/keys adresinden alabilirsiniz."));
  console.log(chalk.gray("  Anahtar 'sk-or-v1-' ile başlamalıdır.\n"));

  let apiKey: string;

  while (true) {
    const input = await password({
      message: "API anahtarınızı girin:",
      mask: "*",
    });

    try {
      apiKey = validateApiKey(input);
      break;
    } catch (err) {
      console.log(chalk.red(`  ✗ ${(err as Error).message}`));
      console.log(chalk.gray("  Lütfen tekrar deneyin.\n"));
    }
  }

  await updateConfig({ apiKey });

  console.log(chalk.green(`\n  ✓ API anahtarı güvenli şekilde kaydedildi: ${CONFIG_FILE}`));
  console.log(chalk.gray("  Anahtarı sıfırlamak için: openrouter-free reset-key\n"));

  return apiKey;
}

/**
 * Ensures an API key is available, prompting if necessary.
 */
export async function ensureApiKey(): Promise<string> {
  if (await hasApiKey()) {
    const { loadConfig } = await import("./config.js");
    const config = await loadConfig();
    return config.apiKey;
  }

  return promptAndSaveApiKey();
}

/**
 * Resets the API key by prompting for a new one.
 */
export async function resetApiKey(): Promise<void> {
  console.log(chalk.yellow("\n⚠️  API anahtarı sıfırlanıyor..."));
  await promptAndSaveApiKey();
}
