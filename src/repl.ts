import { input } from "@inquirer/prompts";
import { writeFile } from "node:fs/promises";
import chalk from "chalk";
import type { OpenRouterModel } from "./openrouter/types.js";
import type { ChatMessage } from "./openrouter/types.js";
import { streamChat, trimHistory } from "./openrouter/chat.js";
import { pickModel } from "./modelPicker.js";
import {
  printChatHeader,
  printHelp,
  printError,
  printSuccess,
  printInfo,
  printAssistantStart,
  printAssistantChunk,
  printAssistantEnd,
  printSeparator,
} from "./output.js";
import { validateChatInput, validateSavePath } from "./security/validate.js";
import { toUserMessage } from "./utils/errors.js";
import { withRetry } from "./utils/retry.js";
import { confirm } from "@inquirer/prompts";
import { existsSync } from "node:fs";

// ─── REPL Chat Session ────────────────────────────────────────────────────────

export interface ReplOptions {
  apiKey: string;
  model: OpenRouterModel;
  allModels: OpenRouterModel[];
  timeoutMs: number;
  maxHistoryMessages: number;
  httpReferer?: string | undefined;
}

/**
 * Starts an interactive REPL chat session with the selected model.
 */
export async function startRepl(options: ReplOptions): Promise<void> {
  let currentModel = options.model;
  let history: ChatMessage[] = [];

  printChatHeader(currentModel.id, currentModel.name);

  while (true) {
    let userInput: string;

    try {
      userInput = await input({
        message: chalk.bold.blue("Siz:"),
        validate: (val) => {
          if (!val.trim()) {
            return "Mesaj boş olamaz.";
          }
          return true;
        },
      });
    } catch {
      // Ctrl+C or EOF
      console.log(chalk.gray("\n  Çıkılıyor..."));
      break;
    }

    const trimmed = userInput.trim();

    // ── REPL Commands ─────────────────────────────────────────────────────────
    if (trimmed.startsWith("/")) {
      const handled = await handleCommand(trimmed, {
        history,
        currentModel,
        allModels: options.allModels,
        onModelChange: (model) => {
          currentModel = model;
          history = [];
          printChatHeader(currentModel.id, currentModel.name);
        },
        onHistoryClear: () => {
          history = [];
          printInfo("Konuşma geçmişi temizlendi.");
        },
      });

      if (handled === "exit") {
        break;
      }
      continue;
    }

    // ── Chat Message ──────────────────────────────────────────────────────────
    let validatedInput: string;
    try {
      validatedInput = validateChatInput(trimmed);
    } catch (err) {
      printError(toUserMessage(err));
      continue;
    }

    history.push({ role: "user", content: validatedInput });
    history = trimHistory(history, options.maxHistoryMessages);

    printAssistantStart(currentModel.name);

    let assistantText = "";
    let hadError = false;

    try {
      await withRetry(
        () => {
          const streamOpts: Parameters<typeof streamChat>[0] = {
            apiKey: options.apiKey,
            model: currentModel.id,
            messages: history,
            timeoutMs: options.timeoutMs,
            onChunk: (chunk) => {
              printAssistantChunk(chunk);
              assistantText += chunk;
            },
            onDone: (full) => {
              assistantText = full;
            },
            onError: (err) => {
              hadError = true;
              printAssistantEnd();
              printError(toUserMessage(err));
            },
          };
          if (options.httpReferer !== undefined) {
            streamOpts.httpReferer = options.httpReferer;
          }
          return streamChat(streamOpts);
        },
        { maxAttempts: 2, baseDelayMs: 2000 },
      );
    } catch (err) {
      hadError = true;
      printAssistantEnd();
      printError(toUserMessage(err));
    }

    printAssistantEnd();

    if (!hadError && assistantText) {
      history.push({ role: "assistant", content: assistantText });
      history = trimHistory(history, options.maxHistoryMessages);
    } else if (hadError) {
      // Remove the user message that caused the error to keep history clean
      history = history.filter((_, i) => i !== history.length - 1);
    }

    printSeparator();
  }

  console.log(chalk.gray("\n  Görüşmek üzere! 👋\n"));
}

// ─── Command Handler ──────────────────────────────────────────────────────────

interface CommandContext {
  history: ChatMessage[];
  currentModel: OpenRouterModel;
  allModels: OpenRouterModel[];
  onModelChange: (model: OpenRouterModel) => void;
  onHistoryClear: () => void;
}

async function handleCommand(
  cmd: string,
  ctx: CommandContext,
): Promise<"exit" | "continue"> {
  const parts = cmd.split(/\s+/);
  const command = parts[0]?.toLowerCase();

  switch (command) {
    case "/exit":
    case "/quit":
      return "exit";

    case "/help":
      printHelp();
      return "continue";

    case "/clear":
      ctx.onHistoryClear();
      return "continue";

    case "/model":
      try {
        const newModel = await pickModel(ctx.allModels, ctx.currentModel.id);
        ctx.onModelChange(newModel);
        printSuccess(`Model değiştirildi: ${newModel.name}`);
      } catch (err) {
        printError(toUserMessage(err));
      }
      return "continue";

    case "/save": {
      const filePath = parts.slice(1).join(" ").trim();
      if (!filePath) {
        printError("Kullanım: /save <dosya_yolu>");
        return "continue";
      }
      await saveConversation(ctx.history, filePath);
      return "continue";
    }

    default:
      printError(`Bilinmeyen komut: ${command}. Yardım için /help yazın.`);
      return "continue";
  }
}

// ─── Save Conversation ────────────────────────────────────────────────────────

async function saveConversation(history: ChatMessage[], rawPath: string): Promise<void> {
  if (history.length === 0) {
    printError("Kaydedilecek konuşma yok.");
    return;
  }

  let resolvedPath: string;
  try {
    resolvedPath = validateSavePath(rawPath);
  } catch (err) {
    printError(toUserMessage(err));
    return;
  }

  // Check for overwrite
  if (existsSync(resolvedPath)) {
    const overwrite = await confirm({
      message: `${resolvedPath} zaten mevcut. Üzerine yazılsın mı?`,
      default: false,
    });

    if (!overwrite) {
      printInfo("Kaydetme iptal edildi.");
      return;
    }
  }

  try {
    const content = formatConversationForSave(history);
    await writeFile(resolvedPath, content, "utf8");
    printSuccess(`Konuşma kaydedildi: ${resolvedPath}`);
  } catch (err) {
    printError(`Dosya kaydedilemedi: ${(err as Error).message}`);
  }
}

function formatConversationForSave(history: ChatMessage[]): string {
  const lines: string[] = [
    `# OpenRouter Free CLI - Konuşma Kaydı`,
    `# Tarih: ${new Date().toLocaleString("tr-TR")}`,
    `# Mesaj sayısı: ${history.length}`,
    "",
  ];

  for (const msg of history) {
    const role = msg.role === "user" ? "Siz" : msg.role === "assistant" ? "Asistan" : "Sistem";
    lines.push(`## ${role}`);
    lines.push(msg.content);
    lines.push("");
  }

  return lines.join("\n");
}
