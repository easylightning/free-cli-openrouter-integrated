import { describe, it, expect } from "vitest";
import { isFreeModel } from "../src/openrouter/models.js";
import type { OpenRouterModel } from "../src/openrouter/types.js";

// ─── Model Filter Tests ───────────────────────────────────────────────────────

function makeModel(pricing: Record<string, string> | undefined): OpenRouterModel {
  return {
    id: "test/model",
    name: "Test Model",
    pricing: pricing as OpenRouterModel["pricing"],
  };
}

describe("isFreeModel", () => {
  // ── Should be FREE ──────────────────────────────────────────────────────────

  it("accepts model with prompt=0 and completion=0", () => {
    expect(isFreeModel(makeModel({ prompt: "0", completion: "0" }))).toBe(true);
  });

  it("accepts model with all optional fields also 0", () => {
    expect(
      isFreeModel(
        makeModel({
          prompt: "0",
          completion: "0",
          request: "0",
          image: "0",
          audio: "0",
          web_search: "0",
        }),
      ),
    ).toBe(true);
  });

  it("accepts model with missing optional fields (request, image, audio)", () => {
    expect(isFreeModel(makeModel({ prompt: "0", completion: "0" }))).toBe(true);
  });

  // ── Should be REJECTED ──────────────────────────────────────────────────────

  it("rejects model with no pricing object", () => {
    expect(isFreeModel(makeModel(undefined))).toBe(false);
  });

  it("rejects model with prompt=0.1 (non-zero)", () => {
    expect(isFreeModel(makeModel({ prompt: "0.1", completion: "0" }))).toBe(false);
  });

  it("rejects model with completion=0.1 (non-zero)", () => {
    expect(isFreeModel(makeModel({ prompt: "0", completion: "0.1" }))).toBe(false);
  });

  it("rejects model with prompt=0.000001 (very small but non-zero)", () => {
    expect(isFreeModel(makeModel({ prompt: "0.000001", completion: "0" }))).toBe(false);
  });

  it("rejects model with completion=0.000001 (very small but non-zero)", () => {
    expect(isFreeModel(makeModel({ prompt: "0", completion: "0.000001" }))).toBe(false);
  });

  it("rejects model with request=0.5 (optional but non-zero)", () => {
    expect(
      isFreeModel(makeModel({ prompt: "0", completion: "0", request: "0.5" })),
    ).toBe(false);
  });

  it("rejects model with image=0.001 (optional but non-zero)", () => {
    expect(
      isFreeModel(makeModel({ prompt: "0", completion: "0", image: "0.001" })),
    ).toBe(false);
  });

  it("rejects model with audio=1 (optional but non-zero)", () => {
    expect(
      isFreeModel(makeModel({ prompt: "0", completion: "0", audio: "1" })),
    ).toBe(false);
  });

  it("rejects model with web_search=0.002 (optional but non-zero)", () => {
    expect(
      isFreeModel(makeModel({ prompt: "0", completion: "0", web_search: "0.002" })),
    ).toBe(false);
  });

  it("rejects model with unknown pricing field that is non-zero", () => {
    expect(
      isFreeModel(makeModel({ prompt: "0", completion: "0", some_new_field: "0.01" })),
    ).toBe(false);
  });

  it("accepts model with unknown pricing field that is zero", () => {
    expect(
      isFreeModel(makeModel({ prompt: "0", completion: "0", some_new_field: "0" })),
    ).toBe(true);
  });

  it("rejects model with unparseable prompt value", () => {
    expect(isFreeModel(makeModel({ prompt: "free", completion: "0" }))).toBe(false);
  });

  it("rejects model with unparseable completion value", () => {
    expect(isFreeModel(makeModel({ prompt: "0", completion: "N/A" }))).toBe(false);
  });

  it("rejects model with empty string prompt", () => {
    expect(isFreeModel(makeModel({ prompt: "", completion: "0" }))).toBe(false);
  });

  it("rejects model with whitespace-only prompt", () => {
    expect(isFreeModel(makeModel({ prompt: "   ", completion: "0" }))).toBe(false);
  });

  it("rejects model with NaN prompt", () => {
    expect(isFreeModel(makeModel({ prompt: "NaN", completion: "0" }))).toBe(false);
  });

  it("rejects model with Infinity prompt", () => {
    expect(isFreeModel(makeModel({ prompt: "Infinity", completion: "0" }))).toBe(false);
  });

  it("rejects model with negative prompt price", () => {
    // Negative prices are not zero
    expect(isFreeModel(makeModel({ prompt: "-0.001", completion: "0" }))).toBe(false);
  });

  it("accepts model with prompt='0.0' (zero with decimal)", () => {
    expect(isFreeModel(makeModel({ prompt: "0.0", completion: "0.0" }))).toBe(true);
  });

  it("accepts model with prompt=' 0 ' (zero with whitespace)", () => {
    expect(isFreeModel(makeModel({ prompt: " 0 ", completion: " 0 " }))).toBe(true);
  });

  // ── Real-world edge cases ───────────────────────────────────────────────────

  it("rejects a model that looks like trial/discounted (0.0000001)", () => {
    expect(
      isFreeModel(makeModel({ prompt: "0.0000001", completion: "0.0000001" })),
    ).toBe(false);
  });

  it("rejects a model with prompt=0 but completion=0.00000001", () => {
    expect(
      isFreeModel(makeModel({ prompt: "0", completion: "0.00000001" })),
    ).toBe(false);
  });
});
