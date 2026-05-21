import { buildProgram } from "./cli/commands.js";
import { toUserMessage } from "./utils/errors.js";
import chalk from "chalk";

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const program = buildProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    // Commander throws for --help and --version (exit code 0), let those pass
    if (err instanceof Error && err.message.includes("process.exit")) {
      return;
    }
    console.error(chalk.red(`\n  ✗ ${toUserMessage(err)}\n`));
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  // Last-resort error handler — must not leak API keys
  const message = err instanceof Error ? err.message : String(err);
  // Redact inline to avoid importing at top level before redact module loads
  const safe = message.replace(/sk-or-v1-[a-zA-Z0-9_-]{8,}/g, "[REDACTED]");
  process.stderr.write(`\nKritik hata: ${safe}\n`);
  process.exit(1);
});
