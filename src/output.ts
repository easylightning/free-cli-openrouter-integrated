import Table from "cli-table3";
import chalk from "chalk";
import type { OpenRouterModel } from "./openrouter/types.js";
import { calculatePowerScore } from "./utils/stars.js";

// ─── Model Table Output ───────────────────────────────────────────────────────

/**
 * Renders a formatted table of free models to stdout.
 */
export function renderModelTable(models: OpenRouterModel[]): void {
  if (models.length === 0) {
    console.log(chalk.yellow("\n  Ücretsiz model bulunamadı.\n"));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold.cyan("#"),
      chalk.bold.cyan("Güç (tahmini)"),
      chalk.bold.cyan("Model ID"),
      chalk.bold.cyan("İsim"),
      chalk.bold.cyan("Bağlam"),
      chalk.bold.cyan("Modaliteler"),
    ],
    style: {
      head: [],
      border: ["gray"],
    },
    colWidths: [5, 16, 40, 30, 12, 20],
    wordWrap: true,
  });

  models.forEach((model, index) => {
    const score = calculatePowerScore(model);
    const contextLen = formatContextLength(model.context_length);
    const modalities = formatModalities(model);

    table.push([
      chalk.gray(String(index + 1)),
      chalk.yellow(score.display),
      chalk.white(truncate(model.id, 38)),
      chalk.gray(truncate(model.name, 28)),
      chalk.cyan(contextLen),
      chalk.magenta(modalities),
    ]);
  });

  console.log(chalk.bold.green("\n  🆓 Tamamen Ücretsiz Modeller (OpenRouter)\n"));
  console.log(table.toString());
  console.log(
    chalk.gray(
      `\n  Toplam ${models.length} ücretsiz model listelendi.`,
    ),
  );
  console.log(chalk.gray("  ★ Güç puanı tahminidir, resmi benchmark değildir.\n"));
}

// ─── Chat Output ──────────────────────────────────────────────────────────────

export function printWelcome(): void {
  console.log(chalk.bold.green("\n  ╔══════════════════════════════════════╗"));
  console.log(chalk.bold.green("  ║     OpenRouter Free CLI  v1.0.0      ║"));
  console.log(chalk.bold.green("  ╚══════════════════════════════════════╝\n"));
}

export function printChatHeader(modelId: string, modelName: string): void {
  console.log(chalk.bold.cyan(`\n  💬 Chat Başlatıldı`));
  console.log(chalk.gray(`  Model: ${chalk.white(modelName)}`));
  console.log(chalk.gray(`  ID:    ${chalk.white(modelId)}`));
  console.log(chalk.gray("  Çıkmak için /exit, yardım için /help yazın.\n"));
  console.log(chalk.gray("  " + "─".repeat(50) + "\n"));
}

export function printHelp(): void {
  console.log(chalk.bold.cyan("\n  Kullanılabilir Komutlar:\n"));
  const commands = [
    ["/exit", "Uygulamadan çık"],
    ["/model", "Model değiştir"],
    ["/clear", "Konuşma geçmişini temizle"],
    ["/save <dosya>", "Konuşmayı dosyaya kaydet"],
    ["/help", "Bu yardım mesajını göster"],
  ];
  for (const [cmd, desc] of commands) {
    if (cmd !== undefined && desc !== undefined) {
      console.log(`  ${chalk.yellow(cmd.padEnd(20))} ${chalk.gray(desc)}`);
    }
  }
  console.log();
}

export function printUserPrompt(): void {
  process.stdout.write(chalk.bold.blue("\n  Siz: "));
}

export function printAssistantStart(modelName: string): void {
  process.stdout.write(chalk.bold.green(`\n  ${truncate(modelName, 20)}: `));
}

export function printAssistantChunk(text: string): void {
  process.stdout.write(chalk.white(text));
}

export function printAssistantEnd(): void {
  process.stdout.write("\n");
}

export function printError(message: string): void {
  console.log(chalk.red(`\n  ✗ ${message}\n`));
}

export function printSuccess(message: string): void {
  console.log(chalk.green(`\n  ✓ ${message}\n`));
}

export function printInfo(message: string): void {
  console.log(chalk.cyan(`\n  ℹ ${message}\n`));
}

export function printWarning(message: string): void {
  console.log(chalk.yellow(`\n  ⚠ ${message}\n`));
}

export function printSeparator(): void {
  console.log(chalk.gray("  " + "─".repeat(50)));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatContextLength(ctx?: number): string {
  if (!ctx) {
    return "—";
  }
  if (ctx >= 1_000_000) {
    return `${(ctx / 1_000_000).toFixed(1)}M`;
  }
  if (ctx >= 1_000) {
    return `${Math.round(ctx / 1_000)}K`;
  }
  return String(ctx);
}

function formatModalities(model: OpenRouterModel): string {
  const inputs = model.architecture?.input_modalities ?? ["text"];
  const outputs = model.architecture?.output_modalities ?? ["text"];

  const inputStr = inputs.join("+");
  const outputStr = outputs.join("+");

  if (inputStr === outputStr) {
    return inputStr;
  }
  return `${inputStr}→${outputStr}`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen - 1) + "…";
}
