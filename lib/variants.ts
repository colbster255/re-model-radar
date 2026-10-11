import type { Retention, Variant } from "./schema";
import { derivesFrom } from "./matching";
export function retention(comparison: Retention): number | null {
  if (
    !comparison.comparable ||
    comparison.original <= 0 ||
    !Number.isFinite(comparison.original) ||
    !Number.isFinite(comparison.modified) ||
    comparison.modified < 0
  )
    return null;
  return (comparison.modified / comparison.original) * 100;
}
export function selectVariant(
  modelId: string,
  variants: Variant[],
): Variant | undefined {
  // Require exact declared provenance; compliance claims never increase preference.
  return variants
    .filter(
      (v) =>
        v.available &&
        v.lineage === "declared" &&
        derivesFrom(modelId, v.baseIds),
    )
    .sort((a, b) => {
      const qa = quality(a),
        qb = quality(b);
      for (let i = 0; i < qa.length; i++) {
        if (qa[i] !== qb[i]) return qb[i] - qa[i];
      }
      return a.id.localeCompare(b.id);
    })[0];
}
export function retentionCategory(
  r: Pick<Retention, "benchmark" | "category">,
) {
  // Refusal/compliance and lower-is-better metrics are never capability retention.
  if (
    /refusal|compliance|harmbench|toxicity|perplexity|loss/i.test(r.benchmark)
  )
    return undefined;
  if (r.category) return r.category;
  if (
    /coding|code-generation|humaneval|mbpp|swe-bench|livecodebench/i.test(
      r.benchmark,
    )
  )
    return "coding";
  if (/cybergym|exploitgym|cybersecurity/i.test(r.benchmark)) return "cyber";
  if (/mmlu|gpqa|reasoning|math/i.test(r.benchmark)) return "reasoning";
  return undefined;
}
function quality(v: Variant) {
  const comparisons = v.retentions.filter(
    (r) => retentionCategory(r) && retention(r) !== null,
  );
  const independent = comparisons.filter((r) => r.kind === "independent");
  const preferred = independent.length ? independent : comparisons;
  // Conservative selection tie-break: weakest measured ratio, capped at parity.
  // This is not displayed as an aggregate capability-retention percentage.
  const floor = preferred.length
    ? Math.min(...preferred.map((r) => Math.min(100, retention(r)!)))
    : -1;
  return [
    independent.length ? 2 : comparisons.length ? 1 : 0,
    floor,
    new Set(preferred.map((r) => `${r.benchmark}:${r.protocol}`)).size,
    v.toolSupport === "declared" ? 1 : 0,
  ];
}
