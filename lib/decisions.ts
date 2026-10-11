import type { Dataset, Evidence } from "./schema";
import { benchmarks } from "./config";

export const decisionVersion = "3.0.0";
export const baselineId = "zai-org/GLM-5.3";
export const candidateId = "moonshotai/Kimi-K3";
type Signal = "reasoning" | "coding" | "security" | "execution";
export const roles = [
  {
    id: "director",
    name: "Director / orchestration",
    weights: { reasoning: 0.4, coding: 0.2, security: 0.1, execution: 0.3 },
    question:
      "Bounded delegation, conflict resolution, unnecessary calls and MCP argument correctness are unmeasured.",
  },
  {
    id: "cpp",
    name: "Direct C/C++ implementation",
    weights: { reasoning: 0.2, coding: 0.6, security: 0.1, execution: 0.1 },
    question:
      "Director task, not a sixth agent. Windows ABI, MSVC compilation and fixing compiler failures require the workflow test.",
  },
  {
    id: "ida",
    name: "IDA / static analysis",
    weights: { reasoning: 0.35, coding: 0.25, security: 0.35, execution: 0.05 },
    question:
      "Recovered types, decompiler interpretation and control-flow reconstruction remain unmeasured.",
  },
  {
    id: "x64dbg",
    name: "x64dbg / user-mode debugging",
    weights: { reasoning: 0.25, coding: 0.2, security: 0.35, execution: 0.2 },
    question:
      "Register/stack evidence, breakpoints and crash diagnosis through your MCP are unmeasured.",
  },
  {
    id: "windbg",
    name: "WinDbg / kernel debugging",
    weights: { reasoning: 0.4, coding: 0.15, security: 0.35, execution: 0.1 },
    question:
      "Symbols, kernel structures and dump triage are unmeasured; general security scores do not establish kernel expertise.",
  },
  {
    id: "ce",
    name: "Cheat Engine / runtime analysis",
    weights: { reasoning: 0.25, coding: 0.25, security: 0.25, execution: 0.25 },
    question:
      "Value/structure validation and safe runtime instrumentation through actual tools are unmeasured.",
  },
] as const;
export type Role = (typeof roles)[number];
export type Options = {
  manufacturer: boolean;
  budget: 2 | 6;
  published: boolean;
  securityMultiplier?: number;
};
export function signal(e: Evidence): Signal | undefined {
  const c = benchmarks[e.benchmark]?.category;
  return c === "cyber"
    ? "security"
    : c === "agentic"
      ? "execution"
      : c === "coding" || c === "reasoning"
        ? c
        : undefined;
}
export function group(e: Evidence) {
  // One publication cannot supply several independent votes, including across task categories.
  return (
    e.correlationGroup ??
    (e.sourceId === "livebench" ? "livebench-publication" : e.sourceId)
  );
}
export function cohort(e: Evidence) {
  return [
    e.benchmark,
    e.protocol,
    e.sourceId,
    e.kind,
    e.budgetHours ?? "default",
    e.comparability ?? "legacy",
  ].join("|");
}
export function current(e: Evidence, now: number) {
  const age = now - Date.parse(e.observedAt);
  return Number.isFinite(age) && age >= 0 && age <= 365 * 86400000;
}
export function percentile(value: number, values: number[]) {
  if (values.length < 3) return null;
  return (
    (100 *
      (values.filter((v) => v < value).length +
        (values.filter((v) => v === value).length - 1) / 2)) /
    (values.length - 1)
  );
}
export type Pair = {
  a: Evidence;
  b: Evidence;
  delta: number;
  rawDelta: number;
  percentileA: number | null;
  percentileB: number | null;
  n: number;
  eligible: boolean;
  reason: string;
  group: string;
};
export function compare(
  data: Pick<Dataset, "evidence" | "variants">,
  aId: string,
  bId: string,
  options: Options,
  now = Date.now(),
): Pair[] {
  // Modified checkpoint evidence is never substituted with base evidence.
  if (data.variants.some((v) => v.id === aId || v.id === bId)) return [];
  const all = data.evidence.filter((e) => current(e, now));
  const latest = new Map<string, Evidence>();
  for (const e of all) {
    const key = `${e.modelId}|${cohort(e)}`;
    if (!latest.has(key) || latest.get(key)!.observedAt < e.observedAt)
      latest.set(key, e);
  }
  const evidence = [...latest.values()];
  return evidence
    .filter((e) => e.modelId === aId)
    .flatMap((a) => {
      const b = evidence.find(
        (e) => e.modelId === bId && cohort(e) === cohort(a),
      );
      if (!b || a.metric !== b.metric || a.denominator !== b.denominator)
        return [];
      const peers = evidence.filter(
        (e) =>
          cohort(e) === cohort(a) &&
          e.metric === a.metric &&
          e.denominator === a.denominator,
      );
      const vetted =
        a.kind === "independent" ||
        (options.manufacturer && a.kind === "manufacturer");
      const publication =
        a.sourceId === "livebench" ||
        a.comparability === "matched" ||
        options.published;
      const budget = !a.budgetHours || a.budgetHours === options.budget;
      const eligible =
        vetted &&
        publication &&
        budget &&
        a.comparability !== "unresolved" &&
        Boolean(signal(a));
      return [
        {
          a,
          b,
          delta: a.value - b.value,
          rawDelta: (a.rawValue ?? a.value) - (b.rawValue ?? b.value),
          percentileA: percentile(
            a.value,
            peers.map((e) => e.value),
          ),
          percentileB: percentile(
            b.value,
            peers.map((e) => e.value),
          ),
          n: peers.length,
          eligible,
          group: group(a),
          reason: !vetted
            ? "Source excluded"
            : !budget
              ? "Other time budget"
              : !publication || a.comparability === "unresolved"
                ? "Peer resource/harness comparability unresolved; descriptive only"
                : a.comparability === "matched"
                  ? "Matched published protocol; TPS-rescaled budget"
                  : "Published comparison; equal resource budgets not established",
        },
      ];
    });
}
export function balance(
  pairs: Pair[],
  role: Role,
  multiplier = 1,
  omit?: string,
): number | null {
  const groups = new Map<
    string,
    Map<Signal, { sum: number; count: number; weight: number }>
  >();
  for (const p of pairs.filter((p) => p.eligible && p.group !== omit)) {
    const s = signal(p.a)!;
    const weight = role.weights[s] * (s === "security" ? multiplier : 1);
    const g =
      groups.get(p.group) ??
      new Map<Signal, { sum: number; count: number; weight: number }>();
    const category = g.get(s) ?? { sum: 0, count: 0, weight };
    category.sum += p.delta;
    category.count++;
    g.set(s, category);
    groups.set(p.group, g);
  }
  const values = [...groups.values()]
    .map((g) => {
      const dimensions = [...g.values()];
      return {
        sum: dimensions.reduce((n, x) => n + (x.sum / x.count) * x.weight, 0),
        weights: dimensions.reduce((n, x) => n + x.weight, 0),
        cap: Math.max(...dimensions.map((x) => x.weight)),
      };
    })
    .filter((g) => g.weights > 0);
  if (!values.length) return null;
  // Average within publication, then cap the publication's influence at its strongest category weight.
  return (
    values.reduce((sum, g) => sum + (g.sum / g.weights) * g.cap, 0) /
    values.reduce((sum, g) => sum + g.cap, 0)
  );
}
export function preference(value: number | null) {
  return value === null
    ? "unknown"
    : Math.abs(value) <= 1
      ? "close / mixed"
      : value > 0
        ? "baseline"
        : "candidate";
}
export function sensitivity(
  data: Pick<Dataset, "evidence" | "variants">,
  a: string,
  b: string,
  role: Role,
  options: Options,
  now = Date.now(),
) {
  const pairs = compare(data, a, b, options, now);
  const scenarios = [
    {
      name: "Selected assumptions",
      value: balance(pairs, role, options.securityMultiplier),
    },
    {
      name: "Independent only",
      value: balance(
        compare(data, a, b, { ...options, manufacturer: false }, now),
        role,
      ),
    },
    {
      name: "Include manufacturer",
      value: balance(
        compare(data, a, b, { ...options, manufacturer: true }, now),
        role,
      ),
    },
    ...([2, 6] as const).map((budget) => ({
      name: `${budget}h ExploitGym`,
      value: balance(compare(data, a, b, { ...options, budget }, now), role),
    })),
    ...Object.keys(role.weights).flatMap((dimension) =>
      [0.75, 1.25].map((factor) => ({
        name: `${dimension} weight ×${factor}`,
        value: balance(pairs, {
          ...role,
          weights: {
            ...role.weights,
            [dimension]: role.weights[dimension as Signal] * factor,
          },
        } as Role),
      })),
    ),
    ...[...new Set(pairs.filter((p) => p.eligible).map((p) => p.group))].map(
      (g) => ({ name: `Without ${g}`, value: balance(pairs, role, 1, g) }),
    ),
  ];
  const conclusions = new Set(scenarios.map((s) => preference(s.value)));
  return {
    pairs,
    scenarios,
    unstable: conclusions.size > 1,
    groups: new Set(pairs.filter((p) => p.eligible).map((p) => p.group)).size,
  };
}
