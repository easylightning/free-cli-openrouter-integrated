import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../src/utils/retry.js";
import { AppError, NetworkError, AuthError } from "../src/utils/errors.js";

// ─── Retry Tests ──────────────────────────────────────────────────────────────

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const op = vi.fn().mockResolvedValue("success");
    const result = await withRetry(op, { maxAttempts: 3, baseDelayMs: 0 });
    expect(result).toBe("success");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable error and succeeds", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValue("success");

    const result = await withRetry(op, { maxAttempts: 3, baseDelayMs: 0, jitter: false });
    expect(result).toBe("success");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on non-retryable error (AuthError)", async () => {
    const op = vi.fn().mockRejectedValue(new AuthError());

    await expect(
      withRetry(op, { maxAttempts: 3, baseDelayMs: 0, jitter: false }),
    ).rejects.toThrow(AuthError);

    expect(op).toHaveBeenCalledTimes(1);
  });

  it("exhausts all attempts and throws last error", async () => {
    const networkErr = new NetworkError();
    const op = vi.fn().mockRejectedValue(networkErr);

    await expect(
      withRetry(op, { maxAttempts: 3, baseDelayMs: 0, jitter: false }),
    ).rejects.toThrow(NetworkError);

    expect(op).toHaveBeenCalledTimes(3);
  });

  it("retries on generic Error (treated as retryable)", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("generic"))
      .mockResolvedValue("ok");

    const result = await withRetry(op, { maxAttempts: 3, baseDelayMs: 0, jitter: false });
    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("does not retry AppError with retryable=false", async () => {
    const err = new AppError("test error", "TEST", false);
    const op = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(op, { maxAttempts: 3, baseDelayMs: 0, jitter: false }),
    ).rejects.toThrow("test error");

    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries AppError with retryable=true", async () => {
    const err = new AppError("server error", "SERVER_ERROR", true);
    const op = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("recovered");

    const result = await withRetry(op, { maxAttempts: 3, baseDelayMs: 0, jitter: false });
    expect(result).toBe("recovered");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("respects maxAttempts=1 (no retries)", async () => {
    const op = vi.fn().mockRejectedValue(new NetworkError());

    await expect(
      withRetry(op, { maxAttempts: 1, baseDelayMs: 0, jitter: false }),
    ).rejects.toThrow(NetworkError);

    expect(op).toHaveBeenCalledTimes(1);
  });
});
