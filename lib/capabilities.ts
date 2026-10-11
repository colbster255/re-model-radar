import { benchmarks, type ScoreCategory } from "./config";
import type { RankedModel } from "./scoring";
export const capabilities = [
  {
    key: "reasoning",
    title: "Thinking / reasoning",
    use: "Infer control flow, track state and test competing explanations.",
    caveat:
      "RE reasoning estimate: reasoning 65%, coding 20%, security 10%, tools 5%.",
  },
  {
    key: "coding",
    title: "Coding",
    use: "Write analysis scripts, debugging harnesses and C/C++ fixes.",
    caveat:
      "Offensive coding estimate: coding 60%, reasoning 20%, security 15%, tools 5%.",
  },
  {
    key: "cyber",
    title: "Reversing",
    use: "Investigate vulnerabilities, crashes and exploitability.",
    caveat:
      "Reversing estimate: reasoning 35%, coding 30%, security 30%, tools 5%.",
  },
  {
    key: "agentic",
    title: "Tool use",
    use: "Work through terminal tasks, builds and multi-step investigations.",
    caveat:
      "RE tool use estimate: tools 55%, reasoning 20%, coding 20%, security 5%.",
  },
] as const;
export function capabilityEvidence(
  model: RankedModel,
  category: ScoreCategory,
) {
  return model.breakdown.filter(
    (e) =>
      benchmarks[e.benchmark].category === category ||
      ["reasoning", "coding", "cyber", "agentic"].includes(
        benchmarks[e.benchmark].category,
      ),
  );
}
export function capabilityLeaders(
  rows: RankedModel[],
  category: ScoreCategory,
) {
  return rows
    .filter((r) => r.qualified && r.scores[category] !== undefined)
    .toSorted(
      (a, b) =>
        b.scores[category]! - a.scores[category]! ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 3)
    .map((model) => ({ ...model, capabilityScore: model.scores[category]! }));
}
