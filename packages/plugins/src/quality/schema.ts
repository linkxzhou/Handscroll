import { z } from "zod";

export const QualityPluginConfigSchema = z.object({
  default: z.enum(["auto", "low", "medium", "high"]).default("auto"),
  dprMax: z.number().optional(),
});

export type QualityPluginConfig = z.infer<typeof QualityPluginConfigSchema>;
