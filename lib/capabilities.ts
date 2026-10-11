import { benchmarks, type ScoreCategory } from "./config";
import type { RankedModel } from "./scoring";
export const capabilities = [
  {
    key: "reasoning",
    title: "Thinking / reasoning",
    use: "Infer control flow, track state and test competing explanations.",
    caveat: "General reasoning tests; binary-analysis transfer is unverified.",
  },
  {
    key: "coding",
    title: "Coding",
    use: "Write analysis scripts, debugging harnesses and C/C++ fixes.",
    caveat:
      "Code generation and repository tasks; Windows/C++ specialization is unverified.",
  },
  {
    key: "cyber",
    title: "Reversing",
    use: "Investigate vulnerabilities, crashes and exploitability.",
    caveat:
      "Security proxy only. No direct IDA/Ghidra/WinDbg or Windows RE evaluation.",
  },
  {
    key: "agentic",
    title: "Tool use",
    use: "Work through terminal tasks, builds and multi-step investigations.",
    caveat:
      "Agentic execution proxy; debugger/MCP tool-call correctness is unverified.",
  },
] as const;
export function capabilityEvidence(
  model: RankedModel,
  category: ScoreCategory,
) {
  return model.breakdown.filter(
    (e) => benchmarks[e.benchmark].category === category,
  );
}
export function capabilityLeaders(
  rows: RankedModel[],
  category: ScoreCategory,
) {
  const cohorts = new Map<
    string,
    { model: RankedModel; evidence: RankedModel["breakdown"][number] }[]
  >();
  for (const model of rows)
    for (const evidence of capabilityEvidence(model, category)) {
      const key = `${evidence.benchmark}:${evidence.sourceId}:${evidence.protocol}:${evidence.kind}`;
      cohorts.set(key, [...(cohorts.get(key) ?? []), { model, evidence }]);
    }
  // Compare the same benchmark/cohort rather than unrelated 100th percentiles.
  const group =
    [...cohorts.values()].sort(
      (a, b) =>
        Number(b[0].evidence.kind === "independent") -
          Number(a[0].evidence.kind === "independent") ||
        b.length - a.length ||
        b[0].evidence.observedAt.localeCompare(a[0].evidence.observedAt) ||
        a[0].evidence.benchmark.localeCompare(b[0].evidence.benchmark),
    )[0] ?? [];
  return group
    .sort(
      (a, b) =>
        b.evidence.normalized - a.evidence.normalized ||
        a.model.name.localeCompare(b.model.name),
    )
    .slice(0, 3)
    .map(({ model, evidence }) => ({
      ...model,
      capabilityScore: evidence.normalized,
      capabilityBenchmark: evidence.benchmark,
      capabilityKind: evidence.kind,
    }));
}
