import { test } from "node:test";
import assert from "node:assert/strict";
import { percentile, scoreModel, rankModels } from "../lib/scoring";
import { newModel } from "../lib/adapters/types";
import { derivesFrom, matchModel } from "../lib/matching";
import { retention, selectVariant } from "../lib/variants";
import {
  datasetSchema,
  evidenceSchema,
  safeUrl,
  type Dataset,
  type Evidence,
  type Variant,
} from "../lib/schema";
import { mergeModels } from "../scripts/refresh";
import { ingestRetention } from "../lib/retention-ingestion";
const model = newModel(
  "example/Model-8B",
  "Model-8B",
  "https://huggingface.co/example/Model-8B",
  "Example",
  true,
);
const comparison = {
  benchmark: "Coding test",
  protocol: "same harness and precision",
  original: 80,
  modified: 76,
  comparable: true,
  source: "https://example.com/eval",
  kind: "creator" as const,
};
function cohort(
  benchmark: string,
  kind: Evidence["kind"] = "independent",
): Evidence[] {
  return [20, 50, 80].map((value, i) =>
    evidenceSchema.parse({
      id: `${benchmark}:${i}`,
      modelId: i === 2 ? model.id : `peer${i}`,
      benchmark,
      protocol: "same protocol",
      value,
      kind,
      source: "https://example.com/results",
      sourceId: "test",
      observedAt: new Date().toISOString(),
    }),
  );
}
const variant: Variant = {
  id: "test/variant",
  name: "variant",
  card: "https://huggingface.co/test/variant",
  baseIds: [model.id],
  lineage: "declared",
  available: true,
  gated: false,
  architecture: "Unverified",
  context: null,
  toolSupport: "unknown",
  providers: [],
  retentions: [],
  refusalNote: "99% refusal reduction claim",
  caveats: [],
  source: "https://example.com",
  updatedAt: new Date().toISOString(),
};
test("percentiles use ties and require three unique peers", () => {
  assert.equal(percentile(50, [20, 50, 80]), 50);
  assert.equal(percentile(50, [50, 50, 50]), 50);
  assert.equal(percentile(50, [50, 80]), null);
});
test("missing categories are excluded from score and reduce coverage", () => {
  const s = scoreModel(model, cohort("cybergym"));
  assert.equal(s.overall, 100);
  assert.equal(s.coverage, 30);
  assert.equal(s.scores.coding, undefined);
  assert.equal(s.qualified, false);
  assert.equal(scoreModel(model, []).overall, null);
});
test("raw percentages on unrelated tests are normalized before weighting", () => {
  const e = [
    ...cohort("cybergym"),
    ...cohort("deepswe").map((x) => ({
      ...x,
      value: x.modelId === model.id ? 10 : 50,
    })),
  ];
  const s = scoreModel(model, e);
  assert.equal(s.coverage, 55);
  assert.ok(Math.abs(s.overall! - (100 * 30) / 55) < 0.001);
  assert.equal(s.qualified, false);
});
test("manufacturer claims can never qualify a model for #1", () => {
  const s = scoreModel(model, [
    ...cohort("cybergym", "manufacturer"),
    ...cohort("deepswe", "manufacturer"),
    ...cohort("terminal21", "manufacturer"),
  ]);
  assert.equal(s.coverage, 70);
  assert.equal(s.qualified, false);
});
test("independent cybersecurity and two categories are necessary", () => {
  assert.equal(
    scoreModel(model, [
      ...cohort("cybergym"),
      ...cohort("deepswe"),
      ...cohort("terminal21"),
    ]).qualified,
    true,
  );
  assert.equal(
    scoreModel(model, [...cohort("deepswe"), ...cohort("terminal21")])
      .qualified,
    false,
  );
});
test("different versions/harnesses never create a false cohort", () => {
  assert.equal(
    scoreModel(
      model,
      cohort("cybergym").map((e, i) => ({ ...e, protocol: `harness${i}` })),
    ).overall,
    null,
  );
});
test("creator and stale evidence are excluded from capability scoring", () => {
  assert.equal(scoreModel(model, cohort("cybergym", "creator")).overall, null);
  assert.equal(
    scoreModel(
      model,
      cohort("cybergym").map((e) => ({
        ...e,
        observedAt: "2020-01-01T00:00:00Z",
      })),
    ).overall,
    null,
  );
});
test("duplicate results do not increase peer count or category weight", () => {
  const e = cohort("cybergym");
  assert.equal(scoreModel(model, [e[2], e[2], e[0]]).overall, null);
  assert.equal(scoreModel(model, [...e, ...e]).overall, 100);
});
test("matching preserves version, size and base checkpoint", () => {
  assert.equal(derivesFrom(model.id, ["example/Model-70B"]), false);
  assert.equal(derivesFrom(model.id, ["EXAMPLE/Model-8B"]), true);
  assert.equal(matchModel("Model-70B", [model]), undefined);
  assert.equal(matchModel("Model-8B-v2", [model]), undefined);
  assert.equal(
    matchModel("Model-8B", [model, { ...model, id: "other/Model-8B" }]),
    undefined,
  );
  assert.equal(
    matchModel(model.id, [model, { ...model, id: "other/Model-8B" }])?.id,
    model.id,
  );
});
test("retention requires a comparable positive baseline", () => {
  assert.equal(retention(comparison), 95);
  assert.equal(retention({ ...comparison, comparable: false }), null);
  assert.equal(retention({ ...comparison, original: 0 }), null);
  assert.equal(retention({ ...comparison, modified: 84 }), 105);
  assert.equal(retention({ ...comparison, original: Infinity }), null);
  assert.equal(retention({ ...comparison, modified: -1 }), null);
});
test("future-dated evidence cannot affect current scores", () => {
  assert.equal(
    scoreModel(
      model,
      cohort("cybergym").map((e) => ({
        ...e,
        observedAt: "2099-01-01T00:00:00Z",
      })),
    ).overall,
    null,
  );
});
test("duplicate observations deterministically prefer the latest result", () => {
  const e = cohort("cybergym");
  const older = {
    ...e[2],
    id: "older",
    value: 0,
    observedAt: "2026-01-01T00:00:00Z",
  };
  assert.equal(scoreModel(model, [...e, older]).overall, 100);
  assert.equal(scoreModel(model, [older, ...e]).overall, 100);
});
test("variant preference considers retention strength before test quantity", () => {
  const strong = { ...variant, id: "test/strong", retentions: [comparison] };
  const weak = {
    ...variant,
    id: "test/weak",
    retentions: [1, 2, 3].map((i) => ({
      ...comparison,
      benchmark: `Coding test ${i}`,
      modified: 20,
    })),
  };
  assert.equal(selectVariant(model.id, [weak, strong])?.id, strong.id);
  const compliance = {
    ...variant,
    id: "test/compliance",
    retentions: [
      { ...comparison, benchmark: "HarmBench compliance", modified: 100 },
    ],
  };
  assert.equal(selectVariant(model.id, [compliance, strong])?.id, strong.id);
  const independent = {
    ...weak,
    retentions: [{ ...comparison, kind: "independent" as const }],
  };
  assert.equal(
    selectVariant(model.id, [strong, independent])?.id,
    independent.id,
  );
});
test("variant selection rewards comparable capability evidence, not compliance", () => {
  const measured = {
    ...variant,
    id: "test/measured",
    retentions: [comparison],
  };
  assert.equal(selectVariant(model.id, [variant, measured])?.id, measured.id);
  assert.equal(selectVariant("example/Model-70B", [variant]), undefined);
  assert.equal(
    selectVariant(model.id, [{ ...variant, lineage: "unverified" }]),
    undefined,
  );
});
test("model merge preserves known data when a source supplies missing fields", () => {
  const old = {
    ...model,
    context: 128000,
    providers: [
      {
        name: "provider",
        url: "https://example.com/api",
        source: "https://example.com/models",
      },
    ],
  };
  const m = mergeModels([old], [model])[0];
  assert.equal(m.context, 128000);
  assert.equal(m.providers.length, 1);
  assert.equal(m.discoveredAt, old.discoveredAt);
});
test("untrusted links and invalid values are rejected", () => {
  assert.equal(safeUrl.safeParse("javascript:alert(1)").success, false);
  assert.equal(
    evidenceSchema.safeParse({ ...cohort("cybergym")[0], value: 101 }).success,
    false,
  );
});
test("structured retention requires explicit matching evaluation conditions", () => {
  const args = {
    harness: "eval",
    harness_version: "1",
    dataset_revision: "sha",
    precision: "FP8",
    shots: 0,
    seed: 42,
  };
  const entry = (value: number, conditions: object = args) => [
    {
      results: [
        {
          task: { type: "coding" },
          dataset: { type: "coding-test", args: conditions },
          metrics: [{ type: "pass@1", value }],
        },
      ],
    },
  ];
  assert.equal(
    ingestRetention(entry(80), entry(76), "https://example.com")[0].modified,
    76,
  );
  assert.deepEqual(
    ingestRetention(
      entry(80),
      entry(76, { ...args, precision: "BF16" }),
      "https://example.com",
    ),
    [],
  );
  assert.deepEqual(
    ingestRetention(entry(80, {}), entry(76, {}), "https://example.com"),
    [],
  );
  const loss = entry(80);
  loss[0].results[0].metrics[0].type = "loss";
  assert.deepEqual(ingestRetention(loss, loss, "https://example.com"), []);
  const compliance = entry(80);
  compliance[0].results[0].dataset.type = "HarmBench compliance";
  assert.deepEqual(
    ingestRetention(compliance, compliance, "https://example.com"),
    [],
  );
});
test("provisional rows have no rank and qualified models take precedence", () => {
  const data: Dataset = datasetSchema.parse({
    schemaVersion: 1,
    refreshedAt: new Date().toISOString(),
    models: [model],
    evidence: cohort("cybergym", "manufacturer"),
    variants: [],
    sources: [],
    previousRanks: {},
  });
  assert.equal(rankModels(data)[0].rank, null);
  data.evidence = [
    ...cohort("cybergym"),
    ...cohort("deepswe"),
    ...cohort("terminal21"),
  ];
  assert.equal(rankModels(data)[0].rank, 1);
  data.models = [{ ...model, name: "Model (w/ fallback)" }];
  assert.deepEqual(rankModels(data), []);
});
