import type { OpenRouterModel } from "../openrouter/types.js";

// ─── Model Power Score ────────────────────────────────────────────────────────
// Estimates model capability from available metadata signals.
// This is a heuristic estimate, NOT a benchmark result.

const FILLED_STAR = "★";
const EMPTY_STAR = "☆";

export interface PowerScore {
  stars: number; // 1–5
  label: string;
  display: string;
}

/**
 * Calculates an estimated power score (1–5 stars) for a model.
 * Based on heuristic signals from model metadata.
 */
export function calculatePowerScore(model: OpenRouterModel): PowerScore {
  let score = 0;

  // ── Context length signal ─────────────────────────────────────────────────
  const ctx = model.context_length ?? 0;
  if (ctx >= 128_000) {
    score += 25;
  } else if (ctx >= 32_000) {
    score += 18;
  } else if (ctx >= 8_000) {
    score += 10;
  } else if (ctx >= 4_000) {
    score += 5;
  }

  // ── Max completion tokens signal ──────────────────────────────────────────
  const maxTokens = model.top_provider?.max_completion_tokens ?? 0;
  if (maxTokens >= 16_000) {
    score += 15;
  } else if (maxTokens >= 8_000) {
    score += 10;
  } else if (maxTokens >= 4_000) {
    score += 5;
  }

  // ── Supported parameters signal ───────────────────────────────────────────
  const params = model.supported_parameters ?? [];
  if (params.includes("tools") || params.includes("tool_choice")) {
    score += 10;
  }
  if (params.includes("reasoning")) {
    score += 10;
  }
  if (params.includes("structured_outputs") || params.includes("response_format")) {
    score += 5;
  }

  // ── Modalities signal ─────────────────────────────────────────────────────
  const inputModalities = model.architecture?.input_modalities ?? [];
  const outputModalities = model.architecture?.output_modalities ?? [];

  if (inputModalities.includes("image")) {
    score += 8;
  }
  if (inputModalities.includes("audio")) {
    score += 5;
  }
  if (outputModalities.includes("image")) {
    score += 5;
  }

  // ── Model name keyword signals ────────────────────────────────────────────
  const nameLower = (model.name + " " + model.id).toLowerCase();

  // Large model indicators
  if (/\b(405b|671b|236b|141b)\b/.test(nameLower)) {
    score += 30;
  } else if (/\b(70b|72b|90b|110b)\b/.test(nameLower)) {
    score += 22;
  } else if (/\b(32b|34b|40b)\b/.test(nameLower)) {
    score += 15;
  } else if (/\b(14b|20b|22b|24b)\b/.test(nameLower)) {
    score += 10;
  } else if (/\b(7b|8b)\b/.test(nameLower)) {
    score += 5;
  }

  // Capability keywords
  if (/\b(r1|reasoning|think)\b/.test(nameLower)) {
    score += 12;
  }
  if (/\b(instruct|chat|it)\b/.test(nameLower)) {
    score += 5;
  }
  if (/\bcoder\b/.test(nameLower)) {
    score += 8;
  }
  if (/\b(turbo|pro|plus|ultra|max)\b/.test(nameLower)) {
    score += 5;
  }

  // ── Normalize to 1–5 stars ────────────────────────────────────────────────
  // Max theoretical score is ~130, map to 1–5
  const stars = Math.max(1, Math.min(5, Math.ceil(score / 26)));

  return {
    stars,
    label: getStarLabel(stars),
    display: renderStars(stars),
  };
}

function renderStars(stars: number): string {
  return FILLED_STAR.repeat(stars) + EMPTY_STAR.repeat(5 - stars);
}

function getStarLabel(stars: number): string {
  switch (stars) {
    case 5:
      return "çok güçlü";
    case 4:
      return "güçlü";
    case 3:
      return "orta";
    case 2:
      return "hafif";
    default:
      return "temel";
  }
}
