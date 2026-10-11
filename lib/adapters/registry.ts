import { z } from "zod";
import { request } from "./http";
import { newModel, type Adapter } from "./types";
import { canonical, matchModel } from "../matching";
import type { Model, Variant } from "../schema";
import { ingestRetention } from "../retention-ingestion";
const hfSchema = z.object({
  id: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  createdAt: z.string().optional(),
  lastModified: z.string().optional(),
  gated: z.union([z.boolean(), z.string()]).optional(),
  cardData: z
    .object({
      base_model: z.union([z.string(), z.array(z.string())]).optional(),
      tags: z.array(z.string()).optional(),
    })
    .passthrough()
    .optional(),
  config: z
    .object({
      model_type: z.string().optional(),
      max_position_embeddings: z.number().optional(),
    })
    .passthrough()
    .optional(),
  siblings: z.array(z.object({ rfilename: z.string() })).optional(),
  tags: z.array(z.string()).optional(),
});
const targets = [
  "zai-org/GLM-5.3",
  "moonshotai/Kimi-K3",
  "dealignai/GLM-5.3-CYBERSECURITY-FP8",
  "dealignai/GLM-5.3-UNCENSORED-FP8",
  "audnai/penclaw-GLM-5.3-abliterated",
  "Uniboshi/Kimi-K3-Abliterated-V1",
];
export const registry: Adapter = {
  id: "huggingface",
  name: "Hugging Face model registry",
  url: "https://huggingface.co/api/models",
  async run(models, previousVariants = []) {
    // Broad discovery, independent of publisher. Recent and popular cohorts complement each other.
    const discovered = [];
    for (const sort of ["createdAt", "trendingScore"]) {
      const url = `${this.url}?pipeline_tag=text-generation&sort=${sort}&direction=-1&limit=75&full=true&config=true`;
      discovered.push(...z.array(hfSchema).parse(await request(url)));
    }
    for (const search of [
      "abliterated",
      "uncensored",
      "derisked",
      "low-refusal",
    ])
      discovered.push(
        ...z
          .array(hfSchema)
          .parse(
            await request(
              `${this.url}?search=${search}&sort=lastModified&direction=-1&limit=25&full=true&config=true`,
            ),
          ),
      );
    // Search exact relevant base names too, so older candidates remain discoverable.
    for (const model of models.filter((m) => m.openWeight).slice(0, 20))
      discovered.push(
        ...z
          .array(hfSchema)
          .parse(
            await request(
              `${this.url}?search=${encodeURIComponent(model.name)}&sort=lastModified&direction=-1&limit=8&full=true&config=true`,
            ),
          ),
      );
    for (const id of targets)
      discovered.push(hfSchema.parse(await request(`${this.url}/${id}`)));
    const variants: Variant[] = [],
      found: Model[] = [];
    const now = new Date().toISOString();
    const byId = new Map(discovered.map((r) => [r.id, r]));
    for (const r of new Map(discovered.map((r) => [r.id, r])).values()) {
      const card = `https://huggingface.co/${r.id}`;
      const tags = [...(r.tags ?? []), ...(r.cardData?.tags ?? [])];
      const isVariant =
        /abliterat|uncensor|derisk|low-refusal|refusal-removed/i.test(
          [r.id, ...tags].join(" "),
        );
      const bases =
        typeof r.cardData?.base_model === "string"
          ? [r.cardData.base_model]
          : (r.cardData?.base_model ?? []);
      const context = r.config?.max_position_embeddings ?? null;
      if (isVariant) {
        variants.push({
          id: r.id,
          name: r.id.split("/")[1],
          card,
          baseIds: bases,
          lineage: bases.length ? "declared" : "unverified",
          available: (r.siblings ?? []).some((f) =>
            /\.(safetensors|gguf|bin)$/.test(f.rfilename),
          ),
          gated: Boolean(r.gated),
          architecture: r.config?.model_type ?? "Unverified",
          context,
          toolSupport: "unknown",
          providers:
            previousVariants.find((v) => v.id === r.id)?.providers ?? [],
          hostingChecks:
            previousVariants.find((v) => v.id === r.id)?.hostingChecks ?? [],
          retentions: [],
          refusalNote:
            "No comparable refusal-reduction measurement ingested. Creator claims require review.",
          caveats: [
            "Lineage is model-card declared, not a forensic weight audit.",
            "Coding, cybersecurity retention and tool-call reliability are unverified.",
          ],
          source: card,
          updatedAt: r.lastModified ?? now,
        });
        continue;
      }
      // Do not promote quantizations/finetunes into base-model entries automatically.
      if (
        bases.length ||
        /gguf|awq|gptq|fp8|mxfp|int4|exl[23]|quant/i.test(r.id.split("/")[1]) ||
        !(r.siblings ?? []).some((f) =>
          /\.(safetensors|gguf|bin)$/.test(f.rfilename),
        )
      )
        continue;
      const name = r.id.split("/")[1],
        existing = models.find(
          (m) => m.id.toLowerCase() === r.id.toLowerCase(),
        );
      const m = {
        ...newModel(r.id, name, card, r.id.split("/")[0], true),
        ...existing,
        id: existing?.id ?? r.id,
        card,
        openWeight: true,
        context: context ?? existing?.context ?? null,
        architecture:
          r.config?.model_type ?? existing?.architecture ?? "Unverified",
        releaseDate: r.createdAt ?? existing?.releaseDate ?? null,
        updatedAt: r.lastModified ?? now,
      };
      found.push(m);
    }
    for (const v of variants) {
      v.providers = [
        ...v.providers,
        ...(models.find((m) => m.id === v.id)?.providers ?? []),
      ].filter((p, i, a) => a.findIndex((x) => x.url === p.url) === i);
      const modified = byId.get(v.id)?.cardData?.["model-index"];
      for (const base of v.baseIds) {
        const original = byId.get(base)?.cardData?.["model-index"];
        v.retentions.push(...ingestRetention(original, modified, v.card));
      }
    }
    // Specific reviewed caveat from the creator's public card; never convert MMLU to coding retention.
    const cyber = variants.find((v) => v.id === targets[2]);
    if (cyber) {
      cyber.toolSupport = "declared";
      cyber.refusalNote =
        "Creator reports 80–84% direct compliance on a non-copyright HarmBench subset. Compliance is not refusal reduction or capability retention.";
      cyber.caveats.push(
        "MMLU-logit comparison uses a BF16 baseline; direct FP8 baseline is pending. No verified coding/RE retention.",
        "Creator reports token-budget exhaustion at high/max effort and practical context below architectural maximum.",
      );
    }
    return {
      models: found,
      variants,
      message:
        "Bounded recent + trending base-model discovery and variant searches. Registry claims remain unverified; previously discovered entries are retained.",
    };
  },
};
export const hosting: Adapter = {
  id: "openrouter",
  name: "OpenRouter model and hosting catalog",
  url: "https://openrouter.ai/api/v1/models",
  async run(models, variants = []) {
    const schema = z.object({
      data: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          canonical_slug: z.string().optional(),
          hugging_face_id: z.string().nullable().optional(),
          context_length: z.number().positive(),
          created: z.number().optional(),
          top_provider: z
            .object({
              max_completion_tokens: z
                .number()
                .positive()
                .nullable()
                .optional(),
            })
            .optional(),
          pricing: z
            .object({ prompt: z.string(), completion: z.string() })
            .optional(),
          supported_parameters: z.array(z.string()).optional(),
        }),
      ),
    });
    const data = schema.parse(await request(this.url));
    const found: Model[] = [];
    for (const r of data.data) {
      if (
        /embedding|image|audio|tts|moderation/i.test(r.id) ||
        r.id.startsWith("openrouter/")
      )
        continue;
      const exact =
        models.find((m) => m.id === r.hugging_face_id || m.id === r.id) ||
        (!r.hugging_face_id
          ? matchModel(r.name.replace(/^.*?:\s*/, ""), models)
          : undefined);
      const m =
        exact ??
        newModel(
          r.hugging_face_id || r.id,
          r.name.replace(/^.*?:\s*/, ""),
          r.hugging_face_id
            ? `https://huggingface.co/${r.hugging_face_id}`
            : `https://openrouter.ai/${r.id}`,
          r.id.split("/")[0],
          Boolean(r.hugging_face_id),
        );
      const existing = found.find((x) => x.id === m.id);
      if (existing) found.splice(found.indexOf(existing), 1);
      found.push({
        ...m,
        context: m.context ?? r.context_length,
        toolSupport: r.supported_parameters?.includes("tools")
          ? "declared"
          : m.toolSupport,
        providers: [
          ...(existing?.providers ??
            m.providers.filter((p) => p.source !== this.url)),
          {
            name: "OpenRouter catalog",
            modelId: r.id,
            mode: r.id.endsWith(":batch") ? "batch" : "interactive",
            context: r.context_length,
            output: r.top_provider?.max_completion_tokens ?? null,
            tools: r.supported_parameters?.includes("tools") ?? false,
            checkedAt: new Date().toISOString(),
            inputPerMillion:
              r.pricing &&
              Number.isFinite(Number(r.pricing.prompt)) &&
              Number(r.pricing.prompt) >= 0
                ? Number(r.pricing.prompt) * 1000000
                : null,
            outputPerMillion:
              r.pricing &&
              Number.isFinite(Number(r.pricing.completion)) &&
              Number(r.pricing.completion) >= 0
                ? Number(r.pricing.completion) * 1000000
                : null,
            url: `https://openrouter.ai/${r.id}`,
            source: this.url,
          },
        ],
        releaseDate:
          m.releaseDate ??
          (r.created ? new Date(r.created * 1000).toISOString() : null),
      });
    }
    return {
      models: [
        ...models.map((m) => ({
          ...m,
          providers: m.providers.filter((p) => p.source !== this.url),
        })),
        ...found,
      ],
      variants: variants.map((v) => {
        const entry = data.data.find(
          (r) => r.hugging_face_id === v.id || r.id === v.id,
        );
        return {
          ...v,
          providers: [
            ...v.providers.filter((p) => p.source !== this.url),
            ...(entry
              ? [
                  {
                    name: "OpenRouter",
                    modelId: entry.id,
                    mode: entry.id.endsWith(":batch")
                      ? ("batch" as const)
                      : ("interactive" as const),
                    context: entry.context_length,
                    output: entry.top_provider?.max_completion_tokens ?? null,
                    checkedAt: new Date().toISOString(),
                    url: "https://openrouter.ai/" + entry.id,
                    source: this.url,
                  },
                ]
              : []),
          ],
          hostingChecks: [
            ...v.hostingChecks.filter((c) => c.provider !== "OpenRouter"),
            {
              provider: "OpenRouter",
              status: entry ? ("listed" as const) : ("not-found" as const),
              source: this.url,
            },
          ],
        };
      }),
      message: `${found.length} catalog entries. Listing is not an inference uptime check; context is provider-declared.`,
    };
  },
};
export function normalizeFamily(id: string) {
  return canonical(id.split("/")[0]);
}
