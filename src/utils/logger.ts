import { redactApiKey } from "../security/redact.js";

// ─── Logger ───────────────────────────────────────────────────────────────────
// A minimal logger that always redacts API keys from output.
// No external logging libraries to avoid accidental key leakage.

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getCurrentLevel(): LogLevel {
  const env = process.env["LOG_LEVEL"]?.toLowerCase();
  if (env === "debug" || env === "info" || env === "warn" || env === "error") {
    return env;
  }
  return "warn";
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") {
    return redactApiKey(value);
  }
  try {
    return redactApiKey(JSON.stringify(value, null, 2));
  } catch {
    return "[unstringifiable value]";
  }
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const currentLevel = getCurrentLevel();
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
    return;
  }

  const redacted = redactApiKey(message);
  const extras = args.map(safeStringify).join(" ");
  const output = extras ? `${redacted} ${extras}` : redacted;

  if (level === "error" || level === "warn") {
    process.stderr.write(`[${level.toUpperCase()}] ${output}\n`);
  } else {
    process.stdout.write(`[${level.toUpperCase()}] ${output}\n`);
  }
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => log("debug", message, ...args),
  info: (message: string, ...args: unknown[]) => log("info", message, ...args),
  warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
  error: (message: string, ...args: unknown[]) => log("error", message, ...args),
};
