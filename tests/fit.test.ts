import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateFit, fitCategories } from "../lib/fit";
import { rankModels } from "../lib/scoring";
import { capabilityLeaders } from "../lib/capabilities";
import { newModel } from "../lib/adapters/types";
import type { Evidence } from "../lib/schema";
const now = Date.parse("2026-10-11T12:00:00Z");
function fixture(
  values: number[],
  kind: Evidence["kind"] = "independent",
  size = 60,
) {
  const keys = [
    "livebench-reasoning",
    "livebench-coding",
    "exploitgym",
    "livebench-agentic",
  ];
  const observations = values.map((normalized, i) => ({
    id: keys[i],
    modelId: "tested",
    benchmark: keys[i],
    sourceId: keys[i],
    protocol: "same",
    kind,
    value: normalized,
    normalized,
    observedAt: new Date(now).toISOString(),
    source: "https://example.com",
    notes: "",
  }));
  const all = observations.flatMap((e) =>
    Array.from({ length: size }, (_, i) => ({
      ...e,
      modelId: i ? `peer-${i}` : "tested",
    })),
  );
  return { observations, all };
}
test("strong adjacent reasoning and coding raise reversing fit without a security test", () => {
  const strong = fixture([95, 95]);
  const weak = fixture([30, 30]);
  const a = estimateFit(strong.observations, strong.all, now);
  const b = estimateFit(weak.observations, weak.all, now);
  assert.ok(a.scores.cyber! > b.scores.cyber!);
  assert.match(a.fits.cyber.explanation, /cyber 30%: unknown/);
  assert.equal(a.fits.cyber.confidence, "Low");
});
test("confidence is separate from capability and tiny cohorts shrink extremes", () => {
  const independent = fixture([90, 80, 70, 85]);
  const claimed = fixture([90, 80, 70, 85], "manufacturer");
  const a = estimateFit(independent.observations, independent.all, now);
  const b = estimateFit(claimed.observations, claimed.all, now);
  assert.equal(a.overall, b.overall);
  assert.ok(a.coverage > b.coverage);
  const small = fixture([90, 80, 70, 85], "independent", 3);
  const c = estimateFit(small.observations, small.all, now);
  assert.ok(c.scores.reasoning! < a.scores.reasoning!);
  assert.ok(c.coverage < a.coverage);
});
test("overlap is geometric, isolated evidence has no rankable overall", () => {
  const f = fixture([95, 85, 40, 20]);
  const result = estimateFit(f.observations, f.all, now);
  const arithmetic =
    fitCategories.reduce((s, c) => s + result.scores[c]!, 0) / 4;
  assert.ok(result.overall! < arithmetic);
  const isolated = fixture([100]);
  assert.equal(
    estimateFit(isolated.observations, isolated.all, now).overall,
    null,
  );
  const empty = estimateFit([], [], now);
  assert.equal(empty.overall, null);
  assert.equal(empty.coverage, 0);
});

test("rankings and shortlists order fit rather than confidence or model identity", () => {
  const high = fixture([95, 95, 95, 95], "manufacturer");
  const lower = fixture([60, 60, 60, 60]);
  const observations = [
    ...high.all.map((e, i) => ({
      ...e,
      value: e.modelId === "tested" ? 95 : ((i % 60) * 100) / 59,
      modelId: e.modelId === "tested" ? "test/high" : "claimed/" + e.modelId,
    })),
    ...lower.all.map((e, i) => ({
      ...e,
      value: e.modelId === "tested" ? 60 : ((i % 60) * 100) / 59,
      modelId:
        e.modelId === "tested" ? "test/lower" : "independent/" + e.modelId,
    })),
  ];
  const rows = rankModels(
    {
      schemaVersion: 1,
      refreshedAt: new Date(now).toISOString(),
      models: [
        newModel("test/high", "Unknown model", "https://example.com", "Test"),
        newModel("test/lower", "Famous model", "https://example.com", "Test"),
      ],
      evidence: observations,
      variants: [],
      sources: [],
      previousRanks: {},
    },
    now,
  );
  assert.equal(rows[0].id, "test/high");
  assert.equal(rows[0].confidence, "Low");
  assert.equal(rows[0].rank, 1);
  for (const c of fitCategories)
    assert.equal(capabilityLeaders(rows, c)[0].id, "test/high");
});
