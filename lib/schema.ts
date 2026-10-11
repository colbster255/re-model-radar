import { z } from "zod";
export const safeUrl = z
  .string()
  .url()
  .refine((v) => new URL(v).protocol === "https:", "HTTPS required");
export const evidenceSchema = z.object({
  id: z.string(),
  modelId: z.string(),
  benchmark: z.string(),
  protocol: z.string(),
  value: z.number().min(0).max(100),
  kind: z.enum(["independent", "manufacturer", "creator", "unverified"]),
  source: safeUrl,
  sourceId: z.string(),
  observedAt: z.string(),
  notes: z.string().default(""),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export const providerSchema = z.object({
  name: z.string(),
  url: safeUrl,
  source: safeUrl,
});
export const modelSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().max(200),
  family: z.string().max(100),
  openWeight: z.boolean(),
  card: safeUrl,
  context: z.number().positive().nullable(),
  toolSupport: z.enum(["declared", "unknown"]),
  architecture: z.string().max(200).default("Unverified"),
  providers: z.array(providerSchema),
  discoveredAt: z.string(),
  updatedAt: z.string(),
  releaseDate: z.string().nullable(),
});
export type Model = z.infer<typeof modelSchema>;
export const retentionSchema = z.object({
  benchmark: z.string(),
  category: z.enum(["coding", "cyber", "reasoning"]).optional(),
  protocol: z.string(),
  original: z.number().positive(),
  modified: z.number().min(0),
  comparable: z.boolean(),
  source: safeUrl,
  kind: z.enum(["independent", "creator"]),
});
export type Retention = z.infer<typeof retentionSchema>;
export const variantSchema = z.object({
  id: z.string(),
  name: z.string(),
  card: safeUrl,
  baseIds: z.array(z.string()),
  lineage: z.enum(["declared", "unverified"]),
  available: z.boolean(),
  gated: z.boolean(),
  architecture: z.string(),
  context: z.number().positive().nullable(),
  toolSupport: z.enum(["declared", "unknown"]),
  providers: z.array(providerSchema),
  hostingChecks: z
    .array(
      z.object({
        provider: z.string(),
        status: z.enum(["listed", "not-found", "inactive"]),
        source: safeUrl,
      }),
    )
    .default([]),
  retentions: z.array(retentionSchema),
  refusalNote: z.string(),
  caveats: z.array(z.string()),
  source: safeUrl,
  updatedAt: z.string(),
});
export type Variant = z.infer<typeof variantSchema>;
export const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: safeUrl,
  status: z.enum(["ok", "error", "monitor"]),
  lastSuccess: z.string().nullable(),
  message: z.string(),
  fingerprint: z.string().optional(),
});
export type Source = z.infer<typeof sourceSchema>;
export const datasetSchema = z.object({
  schemaVersion: z.literal(1),
  refreshedAt: z.string(),
  models: z.array(modelSchema),
  evidence: z.array(evidenceSchema),
  variants: z.array(variantSchema),
  sources: z.array(sourceSchema),
  previousRanks: z.record(z.string(), z.number()),
});
export type Dataset = z.infer<typeof datasetSchema>;
