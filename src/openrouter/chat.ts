import { apiPostStream } from "./client.js";
import { StreamChunkSchema, type ChatMessage } from "./types.js";
import { ParseError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// ─── Chat Streaming ───────────────────────────────────────────────────────────

export interface ChatStreamOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  timeoutMs?: number | undefined;
  httpReferer?: string | undefined;
  maxTokens?: number | undefined;
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (err: Error) => void;
}

/**
 * Sends a chat request with streaming and calls onChunk for each text delta.
 * Handles SSE (Server-Sent Events) parsing from OpenRouter.
 */
export async function streamChat(options: ChatStreamOptions): Promise<void> {
  const body = {
    model: options.model,
    messages: options.messages,
    stream: true,
    ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
  };

  let stream: ReadableStream<Uint8Array>;

  try {
    stream = await apiPostStream("/chat/completions", body, {
      apiKey: options.apiKey,
      timeoutMs: options.timeoutMs,
      httpReferer: options.httpReferer,
    });
  } catch (err) {
    options.onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }

  const fullText = await processStream(stream, options.onChunk);
  options.onDone(fullText);
}

// ─── SSE Stream Parser ────────────────────────────────────────────────────────

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10MB safety limit

async function processStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        logger.warn("Yanıt boyutu sınırı aşıldı, stream kesiliyor.");
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split("\n");
      // Keep the last (potentially incomplete) line in buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed === ":") {
          continue; // Empty line or SSE comment
        }

        if (!trimmed.startsWith("data: ")) {
          continue;
        }

        const data = trimmed.slice(6); // Remove "data: " prefix

        if (data === "[DONE]") {
          return fullText;
        }

        const chunk = parseStreamChunk(data);
        if (chunk !== null) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        }
      }
    }
    // Process any remaining data left in buffer after stream ends
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
        const data = trimmed.slice(6);
        const chunk = parseStreamChunk(data);
        if (chunk !== null) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onChunk(delta);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}

function parseStreamChunk(data: string): ReturnType<typeof StreamChunkSchema.parse> | null {
  try {
    const parsed: unknown = JSON.parse(data);
    const result = StreamChunkSchema.safeParse(parsed);
    if (!result.success) {
      logger.debug("Stream chunk validation failed:", result.error.message);
      return null;
    }
    return result.data;
  } catch {
    // Some providers send non-JSON lines; skip them
    logger.debug("Stream chunk parse error for data:", data.slice(0, 50));
    return null;
  }
}

// ─── OpenRouter Error in Stream ───────────────────────────────────────────────

/**
 * Checks if a stream chunk contains an OpenRouter error payload.
 */
export function extractStreamError(data: string): string | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as Record<string, unknown>)["error"] === "object"
    ) {
      const error = (parsed as { error: { message?: string } }).error;
      return error.message ?? "Bilinmeyen API hatası";
    }
  } catch {
    // Not an error payload
  }
  return null;
}

// ─── Conversation History Management ─────────────────────────────────────────

export const MAX_HISTORY_MESSAGES = 50;

/**
 * Trims conversation history to prevent unbounded memory growth.
 * Always keeps the system message (if any) and the most recent messages.
 */
export function trimHistory(messages: ChatMessage[], maxMessages: number): ChatMessage[] {
  if (messages.length <= maxMessages) {
    return messages;
  }

  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  // Keep system messages + most recent non-system messages
  const keepCount = maxMessages - systemMessages.length;
  const trimmed = nonSystemMessages.slice(-keepCount);

  return [...systemMessages, ...trimmed];
}
