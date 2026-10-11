import { z } from "zod";
import { request } from "./http";
import type { Adapter } from "./types";
import type { Variant } from "../schema";
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
  async run(_models, variants = []) {
    if (variants.length > 200)
      throw Error(
        "Checkpoint lookup bound exceeded; prior hosting data retained",
      );
    const checked: Variant[] = [];
    // Bound concurrency and query exact IDs rather than scanning a partial catalog.
    for (let i = 0; i < variants.length; i += 5) {
      checked.push(
        ...(await Promise.all(
          variants
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
    return {
      variants: checked,
      message: `Checked ${checked.length} exact checkpoint IDs. Active catalog listings only; inference uptime and plan access are not tested.`,
    };
  },
};
