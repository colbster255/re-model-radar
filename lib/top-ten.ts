import type { Dataset, Evidence, Model } from "./schema";
import { selectVariant } from "./variants";

export const rankingVersion = "4.0.0";
export const stats = [
  {
    id: "lb2-coding",
    name: "Coding",
    weight: 0.4,
    explanation: "Fixing real bugs without breaking existing behavior.",
  },
  {
    id: "lb2-reasoning",
    name: "Reasoning",
    weight: 0.35,
    explanation:
      "Logic and state tracking—the foundations of understanding unfamiliar code.",
  },
  {
    id: "lb2-agentic",
    name: "Long tasks",
    weight: 0.25,
    explanation: "Sustained engineering work as requirements and state change.",
  },
] as const;
type Input = Pick<Dataset, "models" | "evidence" | "variants">;
export type Stat = {
  id: string;
  name: string;
  raw: number;
  rank: number;
  source: string;
  notes: string;
};
export type TopModel = Model & {
  rank: number;
  score: number;
  stats: Stat[];
  variant?: Dataset["variants"][number];
  cyber?: Evidence;
  design?: Evidence;
};
export function isFresh(date: string | undefined, now: number, days = 30) {
  const time = Date.parse(date ?? "");
  return Number.isFinite(time) && time <= now && now - time <= days * 86400000;
}
export function topTen(data: Input, now = Date.now()) {
  const observations = data.evidence.filter(
    (e) =>
      e.kind === "independent" &&
      e.sourceId === "livebench" &&
      e.id.startsWith("livebench2:") &&
      isFresh(e.observedAt, now, 90),
  );
  const release = observations
    .map((e) => /^livebench2:(\d{8}):/.exec(e.id)?.[1])
    .filter((r): r is string => Boolean(r))
    .sort()
    .at(-1);
  const current = observations.filter((e) =>
    e.id.startsWith(`livebench2:${release}:`),
  );
  const qualified = data.models.filter(
    (m) =>
      m.openWeight &&
      !data.variants.some((v) => v.id === m.id) &&
      stats.every((s) =>
        current.some((e) => e.modelId === m.id && e.benchmark === s.id),
      ),
  );
  const all = qualified
    .map((m) => {
      const measured = stats.map((s) =>
        current.find((e) => e.modelId === m.id && e.benchmark === s.id)!,
      );
      const values = stats.map((s, i) => ({
        id: s.id,
        name: s.name,
        raw: measured[i].value,
        rank:
          1 +
          qualified.filter(
            (other) =>
              current.find(
                (e) => e.modelId === other.id && e.benchmark === s.id,
              )!.value > measured[i].value,
          ).length,
        source: measured[i].source,
        notes: measured[i].notes,
      }));
      const cyber = data.evidence
        .filter(
          (e) =>
            e.modelId === m.id &&
            ["cybergym", "exploitgym"].includes(e.benchmark) &&
            ["independent", "manufacturer"].includes(e.kind) &&
            isFresh(e.observedAt, now, 365),
        )
        .sort(
          (a, b) =>
            (a.kind === "independent" ? 0 : 1) -
              (b.kind === "independent" ? 0 : 1) ||
            b.observedAt.localeCompare(a.observedAt),
        )[0];
      return {
        ...m,
        score: values.reduce((sum, v, i) => sum + v.raw * stats[i].weight, 0),
        stats: values,
        variant: selectVariant(m.id, data.variants),
        cyber,
        design: current.find(
          (e) => e.modelId === m.id && e.benchmark === "lb2-design",
        ),
      };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {
    release: release ?? null,
    eligible: all.length,
    rows: all.slice(0, 10).map((m, i): TopModel => ({ ...m, rank: i + 1 })),
  };
}
export function callCost(
  provider: Model["providers"][number],
  input: number,
  output: number,
  now = Date.now(),
) {
  if (
    provider.checkStatus === "failed" ||
    provider.name === "OpenRouter catalog" ||
    provider.mode !== "interactive" ||
    !provider.modelId ||
    !isFresh(provider.checkedAt, now) ||
    provider.inputPerMillion == null ||
    provider.outputPerMillion == null ||
    !Number.isFinite(input) ||
    !Number.isFinite(output) ||
    input < 0 ||
    output < 0 ||
    !Number.isFinite(provider.inputPerMillion) ||
    !Number.isFinite(provider.outputPerMillion) ||
    provider.inputPerMillion < 0 ||
    provider.outputPerMillion < 0
  )
    return null;
  if (
    (provider.context != null && input + output > provider.context) ||
    (provider.output != null && output > provider.output)
  )
    return null;
  return (
    (input * provider.inputPerMillion + output * provider.outputPerMillion) /
    1_000_000
  );
}
export function cheapest(
  model: Pick<Model, "providers">,
  input: number,
  output: number,
  now = Date.now(),
) {
  return model.providers
    .flatMap((p) => {
      const cost = callCost(p, input, output, now);
      return cost === null ? [] : [{ ...p, cost }];
    })
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))[0];
}
