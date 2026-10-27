import { z } from "zod";
import { request } from "./http";
import type { Adapter } from "./types";
import { topTen } from "../top-ten";
import type { Model } from "../schema";
const root = "https://openrouter.ai/api/v1/models/";
const schema = z.object({
  data: z.object({
    id: z.string(),
    endpoints: z.array(
      z.object({
        provider_name: z.string(),
        tag: z.string(),
        status: z.number(),
        service_tier: z.string().nullable().optional(),
        quantization: z.string().nullable().optional(),
        context_length: z.number().positive(),
        max_completion_tokens: z.number().positive().nullable().optional(),
        supported_parameters: z.array(z.string()),
        pricing: z.object({
          prompt: z.coerce.number().nonnegative(),
          completion: z.coerce.number().nonnegative(),
        }),
      }),
    ),
  }),
});
export function endpointProfiles(
  payload: unknown,
  id: string,
  checkedAt: string,
): Model["providers"] {
  const data = schema.parse(payload).data;
  if (data.id !== id) throw Error("Endpoint model identity mismatch");
  return data.endpoints
    .filter(
      (e) =>
        e.status === 0 &&
        !["flex", "batch"].includes(e.service_tier ?? "") &&
        e.supported_parameters.includes("tools"),
    )
    .map((e) => ({
      name: `${e.provider_name} via OpenRouter`,
      modelId: id,
      url: `https://openrouter.ai/${id}/providers`,
      source: root + id + "/endpoints",
      mode: "interactive",
      context: e.context_length,
      output: e.max_completion_tokens ?? null,
      inputPerMillion: e.pricing.prompt * 1e6,
      outputPerMillion: e.pricing.completion * 1e6,
      tools: true,
      checkedAt,
      routingTag: e.tag,
      quantization: e.quantization ?? "unknown",
      checkStatus: "ok",
    }));
}
export const endpoints: Adapter = {
  id: "openrouter-endpoints",
  name: "OpenRouter individual provider prices",
  url: "https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model",
  async run(models, variants = [], context) {
    const leaders = topTen({
      models,
      variants,
      evidence: context?.evidence ?? [],
    }).rows;
    const found: Model[] = [];
    let failed = 0;
    for (const m of leaders) {
      const route = m.providers.find(
        (p) =>
          p.source === "https://openrouter.ai/api/v1/models" &&
          p.mode === "interactive" &&
          p.modelId &&
          !p.modelId.includes(":"),
      );
      if (!route?.modelId) continue;
      try {
        const profiles = endpointProfiles(
          await request(root + route.modelId + "/endpoints"),
          route.modelId,
          new Date().toISOString(),
        );
        found.push({
          ...m,
          providers: [
            ...m.providers.filter((p) => !p.source.startsWith(root)),
            ...profiles,
          ],
        });
      } catch {
        failed++;
        found.push({
          ...m,
          providers: m.providers.map((p) =>
            p.source.startsWith(root) ? { ...p, checkStatus: "failed" } : p,
          ),
        });
      }
    }
    return {
      replaceProviders: true,
      models: found,
      message: `${found.length - failed} top-model endpoint checks succeeded; ${failed} failed. Only active, non-flex interactive endpoints with declared tools; routing tags and per-provider prices retained. Failed checks are excluded from cheapest-call selection.`,
    };
  },
};
