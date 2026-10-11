import type { Retention, Variant } from "./schema";
import { derivesFrom } from "./matching";
export function retention(comparison: Retention): number | null {
  if (
    !comparison.comparable ||
    comparison.original <= 0 ||
    !Number.isFinite(comparison.modified)
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
    .sort((a, b) => quality(b) - quality(a) || a.id.localeCompare(b.id))[0];
}
function quality(v: Variant) {
  const comparisons = v.retentions.filter((r) => retention(r) !== null);
  return (
    comparisons.filter((r) => r.kind === "independent").length * 100 +
    comparisons.length * 10 +
    (v.toolSupport === "declared" ? 1 : 0)
  );
}
