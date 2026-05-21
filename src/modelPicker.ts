import { select, input } from "@inquirer/prompts";
import chalk from "chalk";
import type { OpenRouterModel } from "./openrouter/types.js";
import { calculatePowerScore } from "./utils/stars.js";
import { renderModelTable } from "./output.js";
import { validateModelId } from "./security/validate.js";
import { ValidationError } from "./utils/errors.js";

// ─── Model Picker ─────────────────────────────────────────────────────────────

/**
 * Displays the model table and prompts the user to select a model interactively.
 */
export async function pickModel(
  models: OpenRouterModel[],
  defaultModelId?: string,
): Promise<OpenRouterModel> {
  if (models.length === 0) {
    throw new Error("Seçilebilecek ücretsiz model bulunamadı.");
  }

  renderModelTable(models);

  // Build choices for inquirer select
  const choices = models.map((model, index) => {
    const score = calculatePowerScore(model);
    const ctx = formatCtx(model.context_length);
    const label = `${chalk.gray(String(index + 1).padStart(3))}  ${chalk.yellow(score.display)}  ${chalk.white(truncate(model.id, 35))}  ${chalk.gray(ctx)}`;

    return {
      name: label,
      value: model.id,
      short: model.id,
    };
  });

  const defaultValue = defaultModelId ?? models[0]?.id;

  const selectedId = await select({
    message: "Kullanmak istediğiniz modeli seçin:",
    choices,
    default: defaultValue,
    pageSize: 15,
  });

  const selected = models.find((m) => m.id === selectedId);
  if (!selected) {
    throw new Error(`Seçilen model bulunamadı: ${selectedId}`);
  }

  return selected;
}

/**
 * Finds a model by ID from the list.
 * Throws if not found or if the model is not in the free list.
 */
export function findModelById(models: OpenRouterModel[], modelId: string): OpenRouterModel {
  const validated = validateModelId(modelId);
  const found = models.find((m) => m.id === validated);

  if (!found) {
    throw new ValidationError(
      `Model bulunamadı veya ücretsiz değil: ${validated}\n` +
        `  Ücretsiz modelleri görmek için: openrouter-free models`,
    );
  }

  return found;
}

/**
 * Prompts the user to enter a model ID directly.
 */
export async function promptModelId(models: OpenRouterModel[]): Promise<OpenRouterModel> {
  const modelId = await input({
    message: "Model ID girin (veya boş bırakıp listeden seçin):",
    validate: (val) => {
      if (!val.trim()) {
        return true; // Allow empty to fall through to list
      }
      try {
        validateModelId(val);
        return true;
      } catch (err) {
        return (err as Error).message;
      }
    },
  });

  if (!modelId.trim()) {
    return pickModel(models);
  }

  return findModelById(models, modelId.trim());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCtx(ctx?: number): string {
  if (!ctx) {
    return "     —";
  }
  if (ctx >= 1_000_000) {
    return `${(ctx / 1_000_000).toFixed(1)}M ctx`;
  }
  if (ctx >= 1_000) {
    return `${Math.round(ctx / 1_000)}K ctx`;
  }
  return `${ctx} ctx`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen - 1) + "…";
}
