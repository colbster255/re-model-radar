import { benchmarks, type ScoreCategory } from "./config";
import type { Evidence } from "./schema";
export const fitWeights = {
  reasoning: { reasoning: 65, coding: 20, cyber: 10, agentic: 5 },
  coding: { reasoning: 20, coding: 60, cyber: 15, agentic: 5 },
  cyber: { reasoning: 35, coding: 30, cyber: 30, agentic: 5 },
  agentic: { reasoning: 20, coding: 20, cyber: 5, agentic: 55 },
} as const;
export type FitCategory = keyof typeof fitWeights;
export const fitCategories = Object.keys(fitWeights) as FitCategory[];
type Observation = Evidence & { normalized: number };
export function estimateFit(
  breakdown: Observation[],
  all: Evidence[],
  now = Date.now(),
) {
  const signals: Partial<Record<FitCategory, number>> = {};
  const reliability: Partial<Record<FitCategory, number>> = {};
  for (const category of fitCategories) {
    const observations = breakdown.filter(
      (e) => benchmarks[e.benchmark].category === category,
    );
    if (!observations.length) continue;
    const strengths: number[] = [];
    const values = observations.map((e) => {
      const cohort = new Set(
        all
          .filter(
            (p) =>
              p.benchmark === e.benchmark &&
              p.sourceId === e.sourceId &&
              p.protocol === e.protocol &&
              p.kind === e.kind,
          )
          .map((p) => p.modelId),
      ).size;
      const recency =
        1 -
        (Math.max(0, now - Date.parse(e.observedAt)) / (365 * 86400000)) * 0.25;
      strengths.push(
        (e.kind === "independent" ? 0.8 : 0.45) *
          (cohort / (cohort + 10)) *
          recency,
      );
      return 50 + ((e.normalized - 50) * cohort) / (cohort + 10);
    });
    signals[category] = values.reduce((a, b) => a + b, 0) / values.length;
    const agreement = Math.max(...values) - Math.min(...values);
    reliability[category] =
      (strengths.reduce((a, b) => a + b, 0) / strengths.length) *
      (1 - agreement / 200);
  }
  const scores: Partial<Record<ScoreCategory, number>> = {};
  const fits = {} as Record<
    FitCategory,
    {
      score: number | null;
      confidence: string;
      support: number;
      explanation: string;
    }
  >;
  for (const category of fitCategories) {
    const entries = Object.entries(fitWeights[category]) as [
      FitCategory,
      number,
    ][];
    const support = entries.reduce(
      (s, [key, w]) => s + w * (reliability[key] ?? 0),
      0,
    );
    const score = Object.keys(signals).length
      ? entries.reduce((s, [key, w]) => s + w * (signals[key] ?? 50), 0) / 100
      : null;
    if (score !== null) scores[category] = score;
    const confidence =
      score === null ? "Awaiting evidence" : support >= 55 ? "Medium" : "Low";
    const explanation = entries
      .map(
        ([key, w]) =>
          `${key} ${w}%: ${signals[key] === undefined ? "unknown; neutral assumption" : `${signals[key]!.toFixed(1)} adjacent-evidence signal`}`,
      )
      .join("; ");
    fits[category] = {
      score,
      confidence,
      support: Math.round(support),
      explanation,
    };
  }
  const coverage = Math.round(
    fitCategories.reduce((s, c) => s + fits[c].support, 0) / 4,
  );
  const rankable = Object.keys(signals).length >= 2;
  const overall = rankable
    ? Math.pow(
        fitCategories.reduce((p, c) => p * scores[c]!, 1),
        1 / 4,
      )
    : null;
  return {
    scores,
    fits,
    overall,
    coverage,
    qualified: rankable,
    confidence:
      overall === null
        ? "Awaiting evidence"
        : coverage >= 55
          ? "Medium"
          : "Low",
    signalCount: Object.keys(signals).length,
  };
}
