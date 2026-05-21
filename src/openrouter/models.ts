import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { apiGet } from "./client.js";
import { ModelsResponseSchema, type OpenRouterModel } from "./types.js";
import { MODELS_CACHE_FILE } from "../config/paths.js";
import { ParseError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";

// ─── Model Cache Schema ───────────────────────────────────────────────────────

const ModelsCacheSchema = z.object({
  fetchedAt: z.number(),
  models: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      context_length: z.number().optional(),
      pricing: z
        .object({
          prompt: z.string(),
          completion: z.string(),
          request: z.string().optional(),
          image: z.string().optional(),
          audio: z.string().optional(),
          web_search: z.string().optional(),
        })
        .catchall(z.string())
        .optional(),
      architecture: z
        .object({
          input_modalities: z.array(z.string()).optional(),
          output_modalities: z.array(z.string()).optional(),
          tokenizer: z.string().optional(),
          instruct_type: z.string().nullable().optional(),
        })
        .optional(),
      top_provider: z
        .object({
          max_completion_tokens: z.number().nullable().optional(),
          is_moderated: z.boolean().optional(),
        })
        .optional(),
      supported_parameters: z.array(z.string()).optional(),
      created: z.number().optional(),
    }),
  ),
});

type ModelsCache = z.infer<typeof ModelsCacheSchema>;

// ─── Free Model Filter ────────────────────────────────────────────────────────

/**
 * Determines whether a model is completely free.
 * A model is free ONLY if ALL pricing fields that exist are exactly "0".
 * Any non-zero, unparseable, or missing-required field disqualifies the model.
 */
export function isFreeModel(model: OpenRouterModel): boolean {
  const pricing = model.pricing;

  // Must have a pricing object
  if (!pricing) {
    return false;
  }

  // Required fields: prompt and completion must be exactly "0"
  if (!isPricingFieldFree(pricing.prompt)) {
    return false;
  }
  if (!isPricingFieldFree(pricing.completion)) {
    return false;
  }

  // Optional fields: if present, must also be "0"
  const optionalFields = ["request", "image", "audio", "web_search"] as const;
  for (const field of optionalFields) {
    const value = pricing[field];
    if (value !== undefined && !isPricingFieldFree(value)) {
      return false;
    }
  }

  // Check any unknown/extra pricing fields via catchall
  const knownFields = new Set(["prompt", "completion", "request", "image", "audio", "web_search"]);
  for (const [key, value] of Object.entries(pricing)) {
    if (!knownFields.has(key)) {
      // Unknown pricing field — must also be "0"
      if (typeof value !== "string" || !isPricingFieldFree(value)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Returns true only if the pricing field value parses to exactly 0.
 * Returns false for any non-numeric, NaN, or non-zero value.
 */
function isPricingFieldFree(value: string): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return false;
  }
  const parsed = parseFloat(trimmed);
  if (isNaN(parsed)) {
    return false;
  }
  return parsed === 0;
}

// ─── Model Fetcher ────────────────────────────────────────────────────────────

export interface FetchModelsOptions {
  apiKey: string;
  timeoutMs?: number | undefined;
  httpReferer?: string | undefined;
  cacheTtlMs?: number | undefined;
  forceRefresh?: boolean | undefined;
}

/**
 * Fetches free models from OpenRouter, using cache when available.
 */
export async function fetchFreeModels(options: FetchModelsOptions): Promise<OpenRouterModel[]> {
  const cacheTtl = options.cacheTtlMs ?? 3_600_000;

  if (!options.forceRefresh) {
    const cached = await loadCachedModels(cacheTtl);
    if (cached) {
      logger.debug(`Model cache'den ${cached.length} ücretsiz model yüklendi.`);
      return cached;
    }
  }

  logger.debug("OpenRouter'dan model listesi çekiliyor...");

  const raw = await apiGet<unknown>("/models", {
    apiKey: options.apiKey,
    timeoutMs: options.timeoutMs,
    httpReferer: options.httpReferer,
  });

  const result = ModelsResponseSchema.safeParse(raw);
  if (!result.success) {
    logger.debug("Models response validation error:", result.error.format());
    throw new ParseError("Model listesi geçersiz formatta. OpenRouter API yanıtı beklenmedik.");
  }

  const allModels = result.data.data;
  const freeModels = allModels.filter(isFreeModel);

  logger.debug(
    `Toplam ${allModels.length} model içinden ${freeModels.length} ücretsiz model bulundu.`,
  );

  await saveCachedModels(freeModels);

  return freeModels;
}

// ─── Cache Helpers ────────────────────────────────────────────────────────────

async function loadCachedModels(ttlMs: number): Promise<OpenRouterModel[] | null> {
  try {
    const raw = await readFile(MODELS_CACHE_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const result = ModelsCacheSchema.safeParse(parsed);

    if (!result.success) {
      return null;
    }

    const cache: ModelsCache = result.data;
    const age = Date.now() - cache.fetchedAt;

    if (age > ttlMs) {
      logger.debug(`Model cache süresi dolmuş (${Math.round(age / 60_000)} dakika).`);
      return null;
    }

    return cache.models as OpenRouterModel[];
  } catch {
    return null;
  }
}

async function saveCachedModels(models: OpenRouterModel[]): Promise<void> {
  try {
    const cache: ModelsCache = {
      fetchedAt: Date.now(),
      models: models as ModelsCache["models"],
    };

    await mkdir(dirname(MODELS_CACHE_FILE), { recursive: true });
    await writeFile(MODELS_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (err) {
    logger.warn("Model cache kaydedilemedi:", err);
  }
}
