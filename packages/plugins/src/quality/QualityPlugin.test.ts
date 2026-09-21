import { describe, expect, it } from "vitest";
import { policyFor, resolveAutoQuality } from "./QualityPlugin.ts";

describe("quality plugin P-U-05", () => {
  it("low quality lowers upload and concurrency caps", () => {
    const low = policyFor("low");
    const high = policyFor("high");
    expect(low.maxUploadsPerFrame).toBeLessThan(high.maxUploadsPerFrame ?? 99);
    expect(low.maxConcurrentRequests).toBeLessThanOrEqual(high.maxConcurrentRequests ?? 99);
    expect(low.decodedBudgetBytes).toBeLessThan(high.decodedBudgetBytes ?? 1);
  });

  it("auto prefers low on small-memory mock devices", () => {
    expect(resolveAutoQuality({ deviceMemory: 2, userAgent: "Mozilla/5.0 (iPhone)" })).toBe("low");
  });

  it("auto prefers high on a desktop with memory to spare", () => {
    expect(resolveAutoQuality({ deviceMemory: 16, maxTouchPoints: 0, userAgent: "Mozilla/5.0 (Macintosh)" })).toBe("high");
  });

  it("auto prefers medium on a generic mobile UA", () => {
    expect(resolveAutoQuality({ userAgent: "Mozilla/5.0 (Linux; Android 14)", maxTouchPoints: 5 })).toBe("medium");
  });
});
