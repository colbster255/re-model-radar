import { test } from "node:test";
import assert from "node:assert/strict";
import { admit, hash, type Manifest, type Run } from "../lib/workflow-eval";
const h = "a".repeat(64);
const tools = [
  {
    name: "actual-export/read",
    inputSchema: {
      type: "object",
      properties: { address: { type: "integer" } },
      required: ["address"],
      additionalProperties: false,
    },
  },
];
const manifest: Manifest = {
  version: "1.0",
  status: "unrun",
  fixtureHash: h,
  promptHash: h,
  toolSchemaHash: hash(tools),
  tools,
  toolSchemaOrigin: "test fixture schema only; not a real debugger export",
  harness: "offline-unit-test",
  budget: {
    maxSeconds: 10,
    maxInputTokens: 100,
    maxOutputTokens: 100,
    maxCalls: 3,
    maxDelegations: 2,
  },
  contextPolicy: "test",
};
const run: Run = {
  id: "unit-test-only",
  caseId: "x64dbg",
  provider: "not-run",
  checkpoint: "not-run",
  manifestHash: hash(manifest),
  fixtureHash: h,
  promptHash: h,
  toolSchemaHash: hash(tools),
  parameters: {},
  reasoningHistoryHandling: "test",
  startedAt: "2026-10-11T00:00:00Z",
  elapsedSeconds: 1,
  inputTokens: 0,
  outputTokens: 0,
  calls: [
    {
      name: tools[0].name,
      arguments: { address: "bad" },
      status: "invalid-argument",
      result: "bad",
      evidenceRef: "trace:1",
    },
    {
      name: tools[0].name,
      arguments: { address: 42 },
      status: "ok",
      result: "ok",
      evidenceRef: "trace:2",
    },
  ],
  transcriptHash: h,
  artifactHashes: {},
  answer: { cause: "null dereference", function: "seeded_crash" },
  validation: [],
  refused: false,
  refusalReason: null,
  technicalFailures: [],
  judgments: [],
};
test("offline admission checks actual exported schemas, recovery and known answers", () => {
  const { report } = admit(manifest, run);
  assert.equal(report.calls[0].validArguments, false);
  assert.equal(report.calls[1].validArguments, true);
  assert.equal(report.recoveryObserved, true);
  assert.ok(report.objective.every((r) => r.passed));
  assert.equal(report.withinBudget, true);
  assert.equal(report.refused, false);
});
test("mismatched fixtures/schemas are rejected; budgets and refusals stay separate", () => {
  assert.throws(() => admit(manifest, { ...run, fixtureHash: "b".repeat(64) }));
  assert.throws(() => admit({ ...manifest, tools: [] }, run));
  const { report } = admit(manifest, {
    ...run,
    elapsedSeconds: 20,
    refused: true,
    refusalReason: "recorded refusal",
    technicalFailures: ["timeout"],
  });
  assert.equal(report.withinBudget, false);
  assert.equal(report.refused, true);
  assert.deepEqual(report.technicalFailures, ["timeout"]);
});
