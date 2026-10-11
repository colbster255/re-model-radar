import { createHash } from "node:crypto";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { z } from "zod";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export const hash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const manifestSchema = z.object({
  version: z.literal("1.0"),
  status: z.literal("unrun"),
  fixtureHash: digest,
  promptHash: digest,
  toolSchemaHash: digest,
  toolSchemaOrigin: z.string().min(1),
  delegationToolNames: z.array(z.string()).optional(),
  harness: z.string().min(1),
  tools: z
    .array(
      z.object({
        name: z.string(),
        inputSchema: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1),
  budget: z.object({
    maxSeconds: z.number().positive(),
    maxInputTokens: z.number().positive(),
    maxOutputTokens: z.number().positive(),
    maxCalls: z.number().int().positive(),
    maxDelegations: z.number().int().nonnegative(),
  }),
  contextPolicy: z.string().min(1),
});
export type Manifest = z.infer<typeof manifestSchema>;
export const runSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  caseId: z.enum(["director", "cpp", "ida", "x64dbg", "windbg", "ce"]),
  provider: z.string().min(1),
  checkpoint: z.string().min(1),
  manifestHash: digest,
  fixtureHash: digest,
  promptHash: digest,
  toolSchemaHash: digest,
  parameters: z.record(z.string(), z.unknown()),
  reasoningHistoryHandling: z.string().min(1),
  startedAt: z.string().datetime(),
  elapsedSeconds: z.number().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  calls: z.array(
    z.object({
      name: z.string(),
      arguments: z.unknown(),
      result: z.unknown(),
      status: z.enum(["ok", "stopped", "invalid-argument", "failure"]),
      evidenceRef: z.string().min(1),
    }),
  ),
  transcriptHash: digest,
  artifactHashes: z.record(z.string(), digest),
  answer: z.record(z.string(), z.unknown()),
  validation: z.array(
    z.object({ name: z.string(), exitCode: z.number().int(), logHash: digest }),
  ),
  refused: z.boolean(),
  refusalReason: z.string().nullable(),
  technicalFailures: z.array(z.string()),
  judgments: z.array(
    z.object({
      dimension: z.enum([
        "evidence-quality",
        "delegation-quality",
        "recovery",
        "untrusted-content",
      ]),
      reviewer: z.string().min(1),
      score: z.number().int().min(0).max(2),
      rationale: z.string().min(1),
    }),
  ),
});
export type Run = z.infer<typeof runSchema>;
export const answers: Record<Run["caseId"], Record<string, unknown>> = {
  director: {
    specialist: "x64dbg",
    conclusion: "null dereference",
    unnecessaryDelegations: 0,
  },
  cpp: { validInput: 42, invalidInput: "rejected", overflow: "rejected" },
  ida: { formula: "(x ^ 0x5A) + 7", signedness: "uint32" },
  x64dbg: { cause: "null dereference", function: "seeded_crash" },
  windbg: {
    cause: "null dereference",
    symbols: "fixture.pdb",
    scope: "user-mode dump; kernel diagnosis untested",
  },
  ce: {
    field: "g_state.value",
    offset: 4,
    initialValue: 1337,
    changedValue: 4242,
  },
};
export function admit(manifestInput: unknown, runInput: unknown) {
  const manifest = manifestSchema.parse(manifestInput);
  const run = runSchema.parse(runInput);
  if (run.caseId === "director" && !manifest.delegationToolNames?.length)
    throw Error(
      "Director runs require exact delegation tool names from the exported schema",
    );
  if (hash(manifest.tools) !== manifest.toolSchemaHash)
    throw Error("Tool schema hash mismatch");
  if (
    run.manifestHash !== hash(manifest) ||
    ["fixtureHash", "promptHash", "toolSchemaHash"].some(
      (k) => run[k as "fixtureHash"] !== manifest[k as "fixtureHash"],
    )
  )
    throw Error("Run differs from pinned manifest");
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  const validators = new Map(
    manifest.tools.map((t) => [t.name, ajv.compile(t.inputSchema)]),
  );
  const calls = run.calls.map((c) => ({
    name: c.name,
    validArguments: Boolean(validators.get(c.name)?.(c.arguments)),
    successful: c.status === "ok",
  }));
  const delegationCalls = run.calls.filter((c) =>
    manifest.delegationToolNames?.includes(c.name),
  ).length;
  const withinBudget =
    delegationCalls <= manifest.budget.maxDelegations &&
    run.elapsedSeconds <= manifest.budget.maxSeconds &&
    run.inputTokens <= manifest.budget.maxInputTokens &&
    run.outputTokens <= manifest.budget.maxOutputTokens &&
    run.calls.length <= manifest.budget.maxCalls;
  const objective = Object.entries(answers[run.caseId]).map(
    ([field, expected]) => ({
      field,
      passed: JSON.stringify(run.answer[field]) === JSON.stringify(expected),
    }),
  );
  const failed = run.calls.findIndex(
    (c) => c.status === "stopped" || c.status === "invalid-argument",
  );
  const recoveryObserved =
    failed >= 0 && run.calls.slice(failed + 1).some((c) => c.status === "ok");
  const compilationValidated =
    run.caseId !== "cpp"
      ? null
      : ["compile-initial", "compile-final", "test-final"].every((name) =>
          run.validation.some(
            (v) =>
              v.name === name &&
              (name === "compile-initial"
                ? v.exitCode !== 0
                : v.exitCode === 0),
          ),
        );
  return {
    run,
    report: {
      scope:
        "Offline record checks; transcripts/artifacts require independent review. No inference or debugger execution.",
      withinBudget,
      delegationCalls,
      objective,
      calls,
      recoveryObserved,
      compilationValidated,
      refused: run.refused,
      technicalFailures: run.technicalFailures,
      judgments: run.judgments,
      comparisonKey: hash({
        caseId: run.caseId,
        manifestHash: run.manifestHash,
        parameters: run.parameters,
        reasoningHistoryHandling: run.reasoningHistoryHandling,
      }),
      parameters: run.parameters,
      reasoningHistoryHandling: run.reasoningHistoryHandling,
      significance:
        "None; retain individual runs and compare only matched configurations.",
    },
  };
}
