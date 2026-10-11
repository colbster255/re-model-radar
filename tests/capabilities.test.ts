import { test } from "node:test";
import assert from "node:assert/strict";
import { readModelMetadata, readTable } from "../lib/adapters/livebench";
import { scoreModel } from "../lib/scoring";
import { capabilityLeaders } from "../lib/capabilities";
import { newModel } from "../lib/adapters/types";
import type { Evidence } from "../lib/schema";
test("LiveBench reads only literal metadata and rejects malformed numeric tables", () => {
  const m = readModelMetadata(
    'export const modelLinks = { "model": {displayName: "Model", openweight: true, url: runMaliciousCode(), variants: [{rawName: "model-high"}]} };',
  );
  assert.equal(m.get("model")?.displayName, "Model");
  assert.equal(m.get("model")?.url, undefined);
  assert.throws(() => readTable("model,reasoning\na,10,20"), /Incomplete/);
  assert.throws(() => readTable('model,reasoning\n"a",10'), /quoting/);
});
test("reasoning scores remain separate from the weighted overall and qualification", () => {
  const m = newModel("test/model", "Model", "https://example.com", "Test");
  const evidence: Evidence[] = [20, 50, 80].map((value, i) => ({
    id: `${i}`,
    modelId: i === 2 ? m.id : `peer${i}`,
    benchmark: "livebench-reasoning",
    protocol: "same release",
    value,
    kind: "independent",
    source: "https://example.com",
    sourceId: "livebench",
    observedAt: new Date().toISOString(),
    notes: "",
  }));
  const scored = scoreModel(m, evidence);
  assert.equal(scored.scores.reasoning, 100);
  assert.equal(scored.overall, null);
  assert.equal(scored.coverage, 0);
  assert.equal(scored.qualified, false);
  const row = {
    ...m,
    ...scored,
    rank: null,
    previousRank: 0,
    variant: undefined,
  };
  const claimed = {
    ...row,
    id: "claimed",
    breakdown: row.breakdown.map((e) => ({
      ...e,
      kind: "manufacturer" as const,
    })),
    scores: { reasoning: 100 },
  };
  assert.equal(
    capabilityLeaders(
      [claimed, { ...row, scores: { reasoning: 90 } }],
      "reasoning",
    )[0].id,
    m.id,
  );
  const shared = [1, 2, 3].map((i) => ({
    ...row,
    id: `shared${i}`,
    name: `Shared ${i}`,
    breakdown: row.breakdown.map((e) => ({
      ...e,
      modelId: `shared${i}`,
      normalized: 60 + i,
      protocol: "broad cohort",
    })),
  }));
  const isolated = {
    ...row,
    id: "isolated",
    name: "Isolated",
    breakdown: row.breakdown.map((e) => ({
      ...e,
      normalized: 100,
      protocol: "different cohort",
    })),
  };
  const leaders = capabilityLeaders([isolated, ...shared], "reasoning");
  assert.equal(leaders[0].id, "shared3");
  assert.ok(leaders.every((r) => r.id.startsWith("shared")));
});
