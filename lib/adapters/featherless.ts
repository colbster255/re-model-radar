import { topTen } from "../top-ten";
import { z } from "zod";
import { request } from "./http";
import type { Adapter } from "./types";
import type { Variant, Model } from "../schema";
export const featherlessSearch =
  "https://featherless.ai/api/feather/search/models";
const responseSchema = z.object({
  items: z.array(z.object({ id: z.string(), status: z.string() })),
  pagination: z.object({ total_pages: z.number().int().nonnegative() }),
});
export function featherlessResult(variant: Variant, payload: unknown): Variant {
  const result = responseSchema.parse(payload);
  if (result.pagination.total_pages > 1)
    throw Error("Exact checkpoint search was truncated");
  const entry = result.items.find((m) => m.id === variant.id);
  const source = featherlessSearch + "?query=" + encodeURIComponent(variant.id);
  const listed = entry?.status === "active";
  return {
    ...variant,
    providers: [
      ...variant.providers.filter(
        (p) => !p.source.startsWith(featherlessSearch),
      ),
      ...(listed
        ? [
            {
              name: "Featherless",
              checkedAt: new Date().toISOString(),
              modelId: variant.id,
              mode: "interactive" as const,
              url: "https://featherless.ai/models/" + variant.id,
              source,
            },
          ]
        : []),
    ],
    hostingChecks: [
      ...(variant.hostingChecks ?? []).filter(
        (c) => c.provider !== "Featherless",
      ),
      {
        provider: "Featherless",
        status: listed ? "listed" : entry ? "inactive" : "not-found",
        source,
      },
    ],
  };
}
export const featherless: Adapter = {
  id: "featherless",
  name: "Featherless exact checkpoint hosting",
  url: "https://featherless.ai/models",
  async run(models, variants = [], context) {
    const leaders = topTen({
      models,
      variants,
      evidence: context?.evidence ?? [],
    }).rows;
    const preferred = new Set(leaders.map((m) => m.id));
    // Discovery may grow indefinitely; prioritize relevant exact lineages instead of failing the entire collector.
    const candidates = [...variants]
      .sort(
        (a, b) =>
          Number(b.baseIds.some((id) => preferred.has(id))) -
            Number(a.baseIds.some((id) => preferred.has(id))) ||
          b.updatedAt.localeCompare(a.updatedAt),
      )
      .slice(0, 200);
    const checked: Variant[] = [];
    // Bound concurrency and query exact IDs rather than scanning a partial catalog.
    for (let i = 0; i < candidates.length; i += 5) {
      checked.push(
        ...(await Promise.all(
          candidates
            .slice(i, i + 5)
            .map(async (v) =>
              featherlessResult(
                v,
                await request(
                  featherlessSearch + "?query=" + encodeURIComponent(v.id),
                ),
              ),
            ),
        )),
      );
    }
    const baseModels: Model[] = [];
    // Explicit baseline/candidate; other bases remain unknown rather than guessed hosted.
    for (const id of [
      ...new Set([
        ...leaders.map((m) => m.id),
        "zai-org/GLM-5.3",
        "moonshotai/Kimi-K3",
      ]),
    ].filter((id) => !id.startsWith("livebench/"))) {
      const m = models.find((m) => m.id === id);
      if (!m) continue;
      const source = featherlessSearch + "?query=" + encodeURIComponent(id);
      const result = responseSchema.parse(await request(source));
      if (result.pagination.total_pages > 1)
        throw Error("Base lookup truncated");
      const active = result.items.some(
        (x) => x.id === id && x.status === "active",
      );
      const detailSource =
        "https://featherless.ai/api/feather/models/" + encodeURIComponent(id);
      const detail = active
        ? z
            .object({
              id: z.literal(id),
              supports_tool_calling: z.boolean().optional(),
              request_pricing: z
                .object({
                  input_price_per_1m_tokens: z.coerce.number().nonnegative(),
                  output_price_per_1m_tokens: z.coerce.number().nonnegative(),
                })
                .optional(),
              context_length_override: z
                .number()
                .positive()
                .nullable()
                .optional(),
              model_class: z.object({
                context_length: z.number().positive(),
                concurrency_cost: z.number().positive(),
              }),
            })
            .parse(await request(detailSource))
        : null;
      baseModels.push({
        ...m,
        providers: [
          ...m.providers.filter(
            (p) => !p.source.startsWith("https://featherless.ai/"),
          ),
          ...(detail
            ? [
                {
                  name: "Featherless",
                  checkStatus: "ok" as const,
                  url: "https://featherless.ai/models/" + id,
                  source: detailSource,
                  modelId: id,
                  mode: "interactive" as const,
                  context:
                    detail.context_length_override ??
                    detail.model_class.context_length,
                  tools: detail.supports_tool_calling,
                  inputPerMillion:
                    detail.request_pricing?.input_price_per_1m_tokens ?? null,
                  outputPerMillion:
                    detail.request_pricing?.output_price_per_1m_tokens ?? null,
                  output: null,
                  concurrencyUnits: detail.model_class.concurrency_cost,
                  checkedAt: new Date().toISOString(),
                },
              ]
            : []),
        ],
      });
    }
    return {
      replaceProviders: true,
      models: baseModels,
      variants: checked,
      message: `Checked ${checked.length}/${variants.length} exact checkpoint IDs, prioritizing current leaders; ${baseModels.length} base profiles. Unchecked entries retain dated prior checks. Active catalog listings only; inference uptime and plan access are not tested.`,
    };
  },
};
