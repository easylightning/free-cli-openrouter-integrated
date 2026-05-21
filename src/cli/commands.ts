import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, hasApiKey } from "../config/config.js";
import { ensureApiKey, resetApiKey } from "../config/secureStore.js";
import { fetchFreeModels } from "../openrouter/models.js";
import { pickModel, findModelById } from "../modelPicker.js";
import { renderModelTable, printWelcome, printError, printInfo } from "../output.js";
import { startRepl } from "../repl.js";
import { CONFIG_FILE } from "../config/paths.js";
import { toUserMessage } from "../utils/errors.js";
import { validateModelId } from "../security/validate.js";

// ─── CLI Program ──────────────────────────────────────────────────────────────

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("openrouter-free")
    .description("OpenRouter ücretsiz modelleriyle terminal AI chat")
    .version("1.0.0");

  // ── Default command: chat ─────────────────────────────────────────────────
  program
    .command("chat", { isDefault: true })
    .description("AI chat başlat (varsayılan komut)")
    .option("-m, --model <modelId>", "Direkt model ID ile başlat")
    .action(async (opts: { model?: string }) => {
      await runChat(opts.model);
    });

  // ── models ────────────────────────────────────────────────────────────────
  program
    .command("models")
    .description("Ücretsiz modelleri listele")
    .option("--refresh", "Model cache'ini yenile")
    .action(async (opts: { refresh?: boolean }) => {
      await runModels(opts.refresh ?? false);
    });

  // ── config ────────────────────────────────────────────────────────────────
  program
    .command("config")
    .description("Yapılandırma dosyasının yolunu göster")
    .action(() => {
      console.log(chalk.cyan(`\n  Yapılandırma dosyası: ${chalk.white(CONFIG_FILE)}\n`));
    });

  // ── reset-key ─────────────────────────────────────────────────────────────
  program
    .command("reset-key")
    .description("API anahtarını sıfırla")
    .action(async () => {
      await resetApiKey();
    });

  return program;
}

// ─── Chat Runner ──────────────────────────────────────────────────────────────

async function runChat(modelIdArg?: string): Promise<void> {
  printWelcome();

  // Ensure API key
  let apiKey: string;
  try {
    apiKey = await ensureApiKey();
  } catch (err) {
    printError(toUserMessage(err));
    process.exit(1);
  }

  // Load config for settings
  let config;
  try {
    config = await loadConfig();
  } catch {
    // Use defaults if config partially broken
    config = {
      apiKey,
      requestTimeoutMs: 60_000,
      maxHistoryMessages: 50,
      modelsCacheTtlMs: 3_600_000,
    };
  }

  // Fetch free models
  printInfo("Ücretsiz modeller yükleniyor...");
  let models;
  try {
    const fetchOpts: Parameters<typeof fetchFreeModels>[0] = {
      apiKey,
      timeoutMs: config.requestTimeoutMs,
      cacheTtlMs: config.modelsCacheTtlMs,
    };
    const referer = "httpReferer" in config ? (config.httpReferer as string | undefined) : undefined;
    if (referer !== undefined) {
      fetchOpts.httpReferer = referer;
    }
    models = await fetchFreeModels(fetchOpts);
  } catch (err) {
    printError(toUserMessage(err));
    process.exit(1);
  }

  if (models.length === 0) {
    printError("Hiç ücretsiz model bulunamadı. Lütfen daha sonra tekrar deneyin.");
    process.exit(1);
  }

  // Select model
  let selectedModel;
  try {
    if (modelIdArg) {
      const validatedId = validateModelId(modelIdArg);
      selectedModel = findModelById(models, validatedId);
    } else if (config.defaultModel) {
      try {
        selectedModel = findModelById(models, config.defaultModel);
      } catch {
        // Default model no longer free, fall through to picker
        selectedModel = await pickModel(models);
      }
    } else {
      selectedModel = await pickModel(models);
    }
  } catch (err) {
    printError(toUserMessage(err));
    process.exit(1);
  }

  // Start REPL
  const replOpts: Parameters<typeof startRepl>[0] = {
    apiKey,
    model: selectedModel,
    allModels: models,
    timeoutMs: config.requestTimeoutMs,
    maxHistoryMessages: config.maxHistoryMessages,
  };
  const referer2 = "httpReferer" in config ? (config.httpReferer as string | undefined) : undefined;
  if (referer2 !== undefined) {
    replOpts.httpReferer = referer2;
  }
  await startRepl(replOpts);
}

// ─── Models Runner ────────────────────────────────────────────────────────────

async function runModels(forceRefresh: boolean): Promise<void> {
  // Ensure API key
  let apiKey: string;
  try {
    apiKey = await ensureApiKey();
  } catch (err) {
    printError(toUserMessage(err));
    process.exit(1);
  }

  let config;
  try {
    config = await loadConfig();
  } catch {
    config = { apiKey, requestTimeoutMs: 60_000, modelsCacheTtlMs: 3_600_000 };
  }

  if (forceRefresh) {
    printInfo("Model cache yenileniyor...");
  } else {
    printInfo("Ücretsiz modeller yükleniyor...");
  }

  try {
    const fetchOpts: Parameters<typeof fetchFreeModels>[0] = {
      apiKey,
      timeoutMs: config.requestTimeoutMs,
      cacheTtlMs: config.modelsCacheTtlMs,
      forceRefresh,
    };
    const models = await fetchFreeModels(fetchOpts);
    renderModelTable(models);
  } catch (err) {
    printError(toUserMessage(err));
    process.exit(1);
  }
}
