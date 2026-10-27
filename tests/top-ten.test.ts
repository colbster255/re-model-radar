import { test } from "node:test";
import assert from "node:assert/strict";
import { topTen, callCost, cheapest } from "../lib/top-ten";
import { newModel } from "../lib/adapters/types";
import { evidenceSchema, type Model, type Variant } from "../lib/schema";
import {
  readModelMetadata,
  discoverRelease,
  publishedMatch,
} from "../lib/adapters/livebench";
import { endpointProfiles } from "../lib/adapters/endpoints";
import { mergeModels } from "../scripts/refresh";
const now = Date.parse("2026-10-27T20:00:00Z");
test("open registry identity survives duplicate API and placeholder aliases", () => {
  const registry = model("Publisher/model");
  registry.name = "New Model";
  const api = model("router/model", false);
  api.name = "New Model";
  const placeholder = model("livebench/new-model");
  placeholder.name = "New Model";
  assert.equal(
    publishedMatch("New Model", [registry, api, placeholder], true)?.id,
    registry.id,
  );
  assert.equal(
    publishedMatch("New Model Preview", [registry, api, placeholder], true),
    undefined,
  );
  assert.equal(
    publishedMatch(
      "New Model",
      [registry, { ...registry, id: "Other/model" }],
      true,
    ),
    undefined,
  );
});
test("authoritative hosting removal clears dead routes while ordinary discovery preserves known hosting", () => {
  const m = model("test/model");
  m.providers = [
    {
      name: "Featherless",
      source: "https://featherless.ai/models/test/model",
      url: "https://featherless.ai/models/test/model",
    },
  ];
  assert.equal(
    mergeModels([m], [{ ...m, providers: [] }])[0].providers.length,
    1,
  );
  assert.equal(
    mergeModels([m], [{ ...m, providers: [] }], true)[0].providers.length,
    0,
  );
});
function observation(
  id: string,
  benchmark: string,
  value: number,
  release = "20261025",
) {
  return evidenceSchema.parse({
    id: `livebench2:${release}:${benchmark}:${id}`,
    modelId: id,
    benchmark,
    protocol: `LiveBench 2.0 / ${release} / published configuration`,
    value,
    kind: "independent",
    source: "https://livebench.ai/data/20261025/table.csv",
    sourceId: "livebench",
    observedAt: "2026-10-25T00:00:00Z",
  });
}
const model = (id: string, open = true) =>
  newModel(id, id, "https://huggingface.co/test/model", "Test", open);
const suite = (id: string, value: number, release?: string) =>
  ["lb2-coding", "lb2-reasoning", "lb2-agentic"].map((b) =>
    observation(id, b, value, release),
  );
test("v4 ranks only ten open models with all three current shared tests", () => {
  const models = Array.from({ length: 14 }, (_, i) => model(`open/${i}`));
  models.push(model("closed", false), model("untested"));
  const evidence = [
    ...models.slice(0, 14).flatMap((m, i) => suite(m.id, 90 - i)),
    ...suite("closed", 100),
    observation("untested", "lb2-coding", 100),
  ];
  const result = topTen({ models, evidence, variants: [] }, now);
  assert.equal(result.rows.length, 10);
  assert.equal(result.eligible, 14);
  assert.equal(result.rows[0].id, "open/0");
  assert.ok(result.rows.every((m) => m.openWeight && m.stats.length === 3));
  assert.ok(Math.abs(result.rows[0].score - 90) < 1e-8);
});
test("latest releases do not mix with old tests; raw ties share stat ranks", () => {
  const models = [model("a"), model("b"), model("old")];
  const evidence = [
    ...suite("a", 70),
    ...suite("b", 70),
    ...suite("old", 100, "20261014"),
  ];
  const result = topTen({ models, evidence, variants: [] }, now);
  assert.equal(result.eligible, 2);
  assert.ok(result.rows.every((m) => m.stats.every((s) => s.rank === 1)));
  assert.equal(
    topTen({ models, evidence, variants: [] }, now + 100 * 86400000).rows
      .length,
    0,
  );
});
test("cyber/manufacturer claims do not silently boost common score; variants do not inherit it", () => {
  const models = [model("a"), model("modified")];
  const base = topTen({ models, evidence: suite("a", 70), variants: [] }, now)
    .rows[0].score;
  const claim = observation("a", "cybergym", 100);
  claim.kind = "manufacturer";
  const result = topTen(
    {
      models,
      evidence: [...suite("a", 70), ...suite("modified", 100), claim],
      variants: [{ id: "modified" } as Variant],
    },
    now,
  );
  assert.equal(result.rows[0].score, base);
  assert.equal(result.rows.length, 1);
});
test("per-call estimates use one real route, fresh rates and compatible limits", () => {
  const p: Model["providers"][number] = {
    name: "Host",
    url: "https://example.com",
    source: "https://example.com",
    modelId: "actual/id",
    mode: "interactive",
    inputPerMillion: 1,
    outputPerMillion: 2,
    checkedAt: "2026-10-27T00:00:00Z",
    context: 10000,
    output: 2000,
  };
  assert.equal(callCost(p, 2000, 1000, now), 0.004);
  for (const patch of [
    { mode: "batch" as const },
    { checkedAt: "2020-01-01" },
    { checkStatus: "failed" as const },
    { inputPerMillion: -1 },
    { output: 500 },
    { context: 2000 },
    { name: "OpenRouter catalog" },
  ])
    assert.equal(callCost({ ...p, ...patch }, 2000, 1000, now), null);
  assert.equal(callCost(p, NaN, 1000, now), null);
  assert.equal(
    cheapest(
      { providers: [p, { ...p, name: "Cheaper", outputPerMillion: 0.5 }] },
      2000,
      1000,
      now,
    )?.name,
    "Cheaper",
  );
});
test("live release discovery and minified metadata remain data-only", () => {
  assert.equal(
    discoverRelease('const releaseIds=["20261014","20261025"];'),
    "20261025",
  );
  assert.throws(() => discoverRelease("no manifest"));
  const info = readModelMetadata(
    'const a={"new-model":{displayName:"New",openweight:!0,url:evil(),huggingface:"https://huggingface.co/test/new"},"closed":{displayName:"Closed",openweight:!1}};',
  );
  assert.equal(info.get("new-model")?.openweight, true);
  assert.equal(info.get("closed")?.openweight, false);
  assert.equal(info.get("new-model")?.url, undefined);
});
test("provider pricing excludes offline, flex and tool-incompatible endpoints", () => {
  const e = {
    provider_name: "Host",
    tag: "host/fp8",
    status: 0,
    context_length: 10000,
    max_completion_tokens: 2000,
    pricing: { prompt: "0.000001", completion: "0.000002" },
    supported_parameters: ["tools"],
  };
  const result = endpointProfiles(
    {
      data: {
        id: "org/model",
        endpoints: [
          e,
          { ...e, status: -5 },
          { ...e, service_tier: "flex" },
          { ...e, supported_parameters: [] },
        ],
      },
    },
    "org/model",
    "2026-10-27T00:00:00Z",
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].inputPerMillion, 1);
  assert.equal(result[0].routingTag, "host/fp8");
  assert.throws(() =>
    endpointProfiles(
      { data: { id: "wrong", endpoints: [e] } },
      "org/model",
      "2026-10-27T00:00:00Z",
    ),
  );
});
