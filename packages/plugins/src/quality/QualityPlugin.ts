import type { CachePolicy, EngineContext, PluginFactory, QualityLevel, ScrollPlugin } from "@handscroll/core";
import { QualityPluginConfigSchema } from "./schema.ts";

const POLICIES: Record<Exclude<QualityLevel, "auto">, Partial<CachePolicy> & { dprHint: number }> = {
  low: {
    gpuBudgetBytes: 64 * 1024 * 1024,
    decodedBudgetBytes: 48 * 1024 * 1024,
    maxConcurrentRequests: 4,
    maxUploadsPerFrame: 2,
    dprHint: 1,
  },
  medium: {
    gpuBudgetBytes: 128 * 1024 * 1024,
    decodedBudgetBytes: 96 * 1024 * 1024,
    maxConcurrentRequests: 6,
    maxUploadsPerFrame: 4,
    dprHint: 1.5,
  },
  high: {
    gpuBudgetBytes: 256 * 1024 * 1024,
    decodedBudgetBytes: 192 * 1024 * 1024,
    maxConcurrentRequests: 8,
    maxUploadsPerFrame: 8,
    dprHint: 2,
  },
};

export function resolveAutoQuality(env: {
  deviceMemory?: number;
  maxTouchPoints?: number;
  userAgent?: string;
} = {}): Exclude<QualityLevel, "auto"> {
  const ua = env.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const memory =
    env.deviceMemory ??
    (typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined);
  const touch = env.maxTouchPoints ?? (typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0);
  const mobile = /Mobi|Android|iPhone|iPad/i.test(ua) || touch > 1;
  if (memory !== undefined && memory <= 4) return "low";
  if (mobile) return "medium";
  return "high";
}

export function policyFor(quality: QualityLevel, env?: Parameters<typeof resolveAutoQuality>[0]): Partial<CachePolicy> {
  const resolved = quality === "auto" ? resolveAutoQuality(env) : quality;
  const { dprHint: _dpr, ...policy } = POLICIES[resolved];
  return policy;
}

export const createQualityPlugin: PluginFactory = (raw): ScrollPlugin => {
  const config = QualityPluginConfigSchema.parse(raw ?? {});
  let ctx: EngineContext | null = null;

  const apply = (q: QualityLevel) => {
    ctx?.engine.setCachePolicy(policyFor(q));
  };

  return {
    id: "quality",
    priority: 100,
    onRegister(next) {
      ctx = next;
      const initial = next.engine.getQuality() === "auto" ? config.default : next.engine.getQuality();
      apply(initial);
      if (initial !== next.engine.getQuality()) next.engine.setQuality(initial);
    },
    onQualityChange(q) {
      apply(q);
    },
  };
};
