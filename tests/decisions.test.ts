import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baselineId,
  candidateId,
  compare,
  balance,
  percentile,
  roles,
  sensitivity,
} from "../lib/decisions";
import { evidenceSchema, type Evidence, type Variant } from "../lib/schema";
import { exploitCounts, parseCard } from "../lib/card-parser";
const now = Date.parse("2026-10-11T20:00:00Z");
const options = { manufacturer: true, published: false, budget: 6 as const };
function row(modelId: string, value: number, patch: Partial<Evidence> = {}) {
  return evidenceSchema.parse({
    id: `${modelId}:${value}`,
    modelId,
    benchmark: "livebench-coding",
    protocol: "same-release/default",
    value,
    kind: "independent",
    source: "https://example.com/source",
    sourceId: "livebench",
    observedAt: "2026-10-10T00:00:00Z",
    ...patch,
  });
}
const data = (evidence: Evidence[], variants: Variant[] = []) => ({
  evidence,
  variants,
});
test("small raw gap is preserved even when percentile gap is large", () => {
  const pairs = compare(
    data([row(baselineId, 88.2), row(candidateId, 88.3), row("third", 88.1)]),
    baselineId,
    candidateId,
    options,
    now,
  );
  assert.ok(Math.abs(pairs[0].delta + 0.1) < 1e-8);
  assert.equal(pairs[0].percentileA, 50);
  assert.equal(pairs[0].percentileB, 100);
  assert.ok(Math.abs(balance(pairs, roles[1])! + 0.1) < 1e-8);
  assert.equal(percentile(3, [2, 3]), null);
});
test("protocol, attribution, metric and budget cohorts cannot be mixed", () => {
  for (const patch of [
    { protocol: "different" },
    { kind: "manufacturer" as const },
    { sourceId: "mirror" },
    { budgetHours: 2 },
    { metric: "coverage" as const },
  ]) {
    assert.deepEqual(
      compare(
        data([row(baselineId, 80), row(candidateId, 70, patch)]),
        baselineId,
        candidateId,
        options,
        now,
      ),
      [],
    );
  }
});
test("unknown, stale, future and modified checkpoint evidence never inherit a score", () => {
  assert.equal(balance([], roles[0]), null);
  for (const observedAt of ["2020-01-01", "2027-01-01", "bad-date"])
    assert.equal(
      compare(
        data([row(baselineId, 80, { observedAt }), row(candidateId, 70)]),
        baselineId,
        candidateId,
        options,
        now,
      ).length,
      0,
    );
  assert.equal(
    compare(
      data(
        [row(baselineId, 80), row(candidateId, 70)],
        [{ id: candidateId } as Variant],
      ),
      baselineId,
      candidateId,
      options,
      now,
    ).length,
    0,
  );
});
test("reusing publication inputs does not multiply its influence", () => {
  const evidence = [
    row(baselineId, 80),
    row(candidateId, 70),
    row(baselineId, 50, { id: "other-a", sourceId: "other" }),
    row(candidateId, 60, { id: "other-b", sourceId: "other" }),
  ];
  const original = balance(
    compare(data(evidence), baselineId, candidateId, options, now),
    roles[1],
  );
  for (let i = 0; i < 20; i++)
    evidence.push(
      row(baselineId, 80, { id: `a${i}`, protocol: `new${i}` }),
      row(candidateId, 70, { id: `b${i}`, protocol: `new${i}` }),
    );
  assert.ok(
    Math.abs(
      balance(
        compare(data(evidence), baselineId, candidateId, options, now),
        roles[1],
      )! - original!,
    ) < 1e-8,
  );
});
test("manufacturer reports are optional and source sensitivity is explicit", () => {
  const evidence = [
    row(baselineId, 70),
    row(candidateId, 80),
    row(baselineId, 90, {
      sourceId: "glm-card",
      benchmark: "exploitgym",
      kind: "manufacturer",
      comparability: "matched",
    }),
    row(candidateId, 60, {
      sourceId: "glm-card",
      benchmark: "exploitgym",
      kind: "manufacturer",
      comparability: "matched",
    }),
  ];
  assert.equal(
    compare(
      data(evidence),
      baselineId,
      candidateId,
      { ...options, manufacturer: false },
      now,
    ).filter((p) => p.eligible).length,
    1,
  );
  assert.equal(
    sensitivity(data(evidence), baselineId, candidateId, roles[2], options, now)
      .unstable,
    true,
  );
});
test("unresolved peer budgets are descriptive unless explicitly explored", () => {
  const evidence = [
    row(baselineId, 80, { sourceId: "glm-card", comparability: "published" }),
    row(candidateId, 70, { sourceId: "glm-card", comparability: "published" }),
  ];
  assert.equal(
    compare(data(evidence), baselineId, candidateId, options, now)[0].eligible,
    false,
  );
  assert.equal(
    compare(
      data(evidence),
      baselineId,
      candidateId,
      { ...options, published: true },
      now,
    )[0].eligible,
    true,
  );
});
test("ExploitGym count parser rejects malformed/overflow and keeps 2h/6h separate", () => {
  assert.deepEqual(exploitCounts("105 / 130"), [105, 130]);
  for (const cell of ["105", "105/870", "-1/5", "NaN/5"])
    assert.throws(() => exploitCounts(cell));
  const header =
    "| Benchmark | GLM-5.3 | Kimi K3 | Qwen3.8-Max |\n|--|--|--|--|\n";
  const text =
    header +
    "| ExploitGym (2h / 6h) | 105 / 130 | 36 / 70 | 14 / 26 |\n| CyberGym | 84.5 | 80 | 78.5 |\n| ExploitBench | 54.4 | 32.2 | 28.8 |";
  const rows = parseCard(
    text,
    [baselineId, candidateId, "Qwen/Qwen3.8-Max"],
    "2026-10-11T00:00:00Z",
  );
  const glm = rows.filter(
    (r) => r.modelId === baselineId && r.benchmark === "exploitgym",
  );
  assert.deepEqual(
    glm.map((r) => r.budgetHours),
    [2, 6],
  );
  assert.deepEqual(
    glm.map((r) => r.rawValue),
    [105, 130],
  );
  assert.ok(Math.abs(glm[1].value - (130 / 869) * 100) < 1e-8);
  assert.ok(rows.every((r) => r.kind === "manufacturer"));
  assert.equal(
    rows.find((r) => r.benchmark === "exploitbench")?.metric,
    "coverage",
  );
  const pairs = compare(data(rows), baselineId, candidateId, options, now);
  assert.equal(pairs.filter((p) => p.eligible).length, 1);
  assert.equal(pairs.find((p) => p.a.budgetHours === 6)?.rawDelta, 60);
});
