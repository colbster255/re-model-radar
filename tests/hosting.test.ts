import { test } from "node:test";
import assert from "node:assert/strict";
import { featherlessResult } from "../lib/adapters/featherless";
import { hosting } from "../lib/adapters/registry";
import { variantSchema } from "../lib/schema";
const variant = variantSchema.parse({
  id: "creator/model-abliterated",
  name: "Model abliterated",
  card: "https://huggingface.co/creator/model-abliterated",
  baseIds: ["publisher/model"],
  lineage: "declared",
  available: true,
  gated: false,
  architecture: "Unknown",
  context: null,
  toolSupport: "unknown",
  providers: [],
  retentions: [],
  refusalNote: "Unknown",
  caveats: [],
  source: "https://huggingface.co/creator/model-abliterated",
  updatedAt: new Date().toISOString(),
});
test("Featherless requires the exact active checkpoint, retains other hosts and removes stale listings", () => {
  const listed = featherlessResult(variant, {
    items: [{ id: variant.id, status: "active" }],
    pagination: { total_pages: 1 },
  });
  assert.equal(listed.providers[0].name, "Featherless");
  const both = {
    ...listed,
    providers: [
      ...listed.providers,
      {
        name: "OpenRouter",
        url: "https://openrouter.ai/creator/model",
        source: hosting.url,
      },
    ],
  };
  const absent = featherlessResult(both, {
    items: [{ id: "publisher/model", status: "active" }],
    pagination: { total_pages: 1 },
  });
  assert.deepEqual(
    absent.providers.map((p) => p.name),
    ["OpenRouter"],
  );
  assert.equal(
    absent.hostingChecks.find((c) => c.provider === "Featherless")?.status,
    "not-found",
  );
  const inactive = featherlessResult(variant, {
    items: [{ id: variant.id, status: "disabled" }],
    pagination: { total_pages: 1 },
  });
  assert.equal(inactive.providers.length, 0);
  assert.equal(inactive.hostingChecks[0].status, "inactive");
  assert.throws(
    () =>
      featherlessResult(variant, { items: [], pagination: { total_pages: 2 } }),
    /truncated/,
  );
  assert.throws(() => featherlessResult(variant, { unexpected: [] }), /items/);
});
test("OpenRouter base hosting does not imply modified-checkpoint hosting", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "provider/model",
              name: "Model abliterated",
              hugging_face_id: "publisher/model",
              context_length: 1000,
            },
          ],
        }),
        { status: 200 },
      );
    const baseOnly = await hosting.run([], [variant]);
    assert.equal(baseOnly.variants![0].providers.length, 0);
    assert.equal(baseOnly.variants![0].hostingChecks[0].status, "not-found");
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "provider/modified",
              name: "Different display label",
              hugging_face_id: variant.id,
              context_length: 1000,
            },
          ],
        }),
        { status: 200 },
      );
    const exact = await hosting.run([], [variant]);
    assert.equal(exact.variants![0].providers[0].name, "OpenRouter");
  } finally {
    globalThis.fetch = original;
  }
});
