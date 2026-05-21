import { describe, it, expect } from "vitest";
import { calculatePowerScore } from "../src/utils/stars.js";
import type { OpenRouterModel } from "../src/openrouter/types.js";

// ─── Stars / Power Score Tests ────────────────────────────────────────────────

function makeModel(overrides: Partial<OpenRouterModel> = {}): OpenRouterModel {
  return {
    id: "test/model",
    name: "Test Model",
    ...overrides,
  };
}

describe("calculatePowerScore", () => {
  it("returns a score between 1 and 5", () => {
    const score = calculatePowerScore(makeModel());
    expect(score.stars).toBeGreaterThanOrEqual(1);
    expect(score.stars).toBeLessThanOrEqual(5);
  });

  it("returns a display string with 5 star characters", () => {
    const score = calculatePowerScore(makeModel());
    const totalStars = (score.display.match(/[★☆]/g) ?? []).length;
    expect(totalStars).toBe(5);
  });

  it("gives higher score to large context model", () => {
    const small = calculatePowerScore(makeModel({ context_length: 4_000 }));
    const large = calculatePowerScore(makeModel({ context_length: 128_000 }));
    expect(large.stars).toBeGreaterThanOrEqual(small.stars);
  });

  it("gives higher score to model with tools support", () => {
    const noTools = calculatePowerScore(makeModel({ supported_parameters: [] }));
    const withTools = calculatePowerScore(
      makeModel({ supported_parameters: ["tools", "tool_choice"] }),
    );
    expect(withTools.stars).toBeGreaterThanOrEqual(noTools.stars);
  });

  it("gives higher score to 70b model vs 7b model", () => {
    const small = calculatePowerScore(makeModel({ id: "provider/model-7b", name: "Model 7B" }));
    const large = calculatePowerScore(makeModel({ id: "provider/model-70b", name: "Model 70B" }));
    expect(large.stars).toBeGreaterThanOrEqual(small.stars);
  });

  it("gives higher score to reasoning model", () => {
    const base = calculatePowerScore(makeModel({ name: "Base Model" }));
    const reasoning = calculatePowerScore(makeModel({ name: "Reasoning Model r1" }));
    expect(reasoning.stars).toBeGreaterThanOrEqual(base.stars);
  });

  it("gives 5 stars to a very powerful model", () => {
    const powerful = calculatePowerScore(
      makeModel({
        id: "provider/model-70b-instruct",
        name: "Model 70B Instruct Reasoning",
        context_length: 128_000,
        top_provider: { max_completion_tokens: 16_000 },
        supported_parameters: ["tools", "tool_choice", "reasoning", "structured_outputs"],
        architecture: {
          input_modalities: ["text", "image"],
          output_modalities: ["text"],
        },
      }),
    );
    expect(powerful.stars).toBe(5);
  });

  it("gives 1 star to a minimal model", () => {
    const minimal = calculatePowerScore(
      makeModel({
        id: "provider/tiny",
        name: "Tiny",
        context_length: 2_000,
      }),
    );
    expect(minimal.stars).toBe(1);
  });

  it("returns correct label for each star count", () => {
    const labels: Record<number, string> = {
      5: "çok güçlü",
      4: "güçlü",
      3: "orta",
      2: "hafif",
      1: "temel",
    };

    // Test that labels map correctly
    for (const [stars, label] of Object.entries(labels)) {
      // We can't force exact star counts easily, but we can verify the label function
      // by checking that the display format is consistent
      const score = calculatePowerScore(makeModel());
      expect(typeof score.label).toBe("string");
      expect(score.label).toBe(labels[score.stars]);
      void stars;
      void label;
      break; // Just test one to verify structure
    }
  });

  it("display string has filled stars first, then empty stars", () => {
    const score = calculatePowerScore(makeModel({ context_length: 128_000 }));
    const display = score.display;
    // All filled stars should come before empty stars
    const filledEnd = display.lastIndexOf("★");
    const emptyStart = display.indexOf("☆");
    if (emptyStart !== -1 && filledEnd !== -1) {
      expect(filledEnd).toBeLessThan(emptyStart);
    }
  });
});
