import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { datasetSchema, type Dataset, type Model } from "../lib/schema";
import { benchmarkAdapters } from "../lib/adapters/benchmarks";
import { endpoints } from "../lib/adapters/endpoints";
import { featherless } from "../lib/adapters/featherless";
import { livebench } from "../lib/adapters/livebench";
import { registry, hosting } from "../lib/adapters/registry";
import { fingerprint } from "../lib/adapters/http";
import {
  decisionVersion,
  baselineId,
  candidateId,
  roles,
  sensitivity,
} from "../lib/decisions";
import { topTen, rankingVersion } from "../lib/top-ten";
import { rankModels } from "../lib/scoring";
import type { Adapter } from "../lib/adapters/types";
import { join } from "node:path";
export function mergeModels(
  previous: Model[],
  incoming: Model[],
  replaceProviders = false,
) {
  const map = new Map(previous.map((m) => [m.id, m]));
  for (const m of incoming) {
    const old = map.get(m.id);
    map.set(
      m.id,
      old
        ? {
            ...old,
            ...m,
            discoveredAt: old.discoveredAt,
            context: m.context ?? old.context,
            architecture:
              m.architecture === "Unverified"
                ? old.architecture
                : m.architecture,
            providers: replaceProviders
              ? m.providers
              : m.providers.length
                ? m.providers
                : old.providers,
            toolSupport:
              m.toolSupport === "unknown" ? old.toolSupport : m.toolSupport,
          }
        : m,
    );
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}
function material(data: Dataset) {
  return {
    decisionPolicyVersion: data.decisionPolicyVersion,
    models: data.models.map(({ discoveredAt, updatedAt, ...m }) => {
      void discoveredAt;
      void updatedAt;
      return {
        ...m,
        providers: m.providers.map(({ checkedAt, ...p }) => {
          void checkedAt;
          return p;
        }),
      };
    }),
    evidence: data.evidence.map(({ checkedAt, ...e }) => {
      void checkedAt;
      return e.sourceId === "glm-card"
        ? { ...e, observedAt: "retrieval date; content unchanged" }
        : e;
    }),
    variants: data.variants.map(({ updatedAt, ...v }) => {
      void updatedAt;
      return v;
    }),
    sources: data.sources.map(({ lastSuccess, ...s }) => {
      void lastSuccess;
      return s;
    }),
  };
}
async function atomic(path: string, value: unknown) {
  await writeFile(path + ".tmp", JSON.stringify(value, null, 2) + "\n");
  await rename(path + ".tmp", path);
}
export async function refresh(
  options: { adapters?: Adapter[]; directory?: string } = {},
) {
  const directory = options.directory ?? "data";
  const adapters = options.adapters ?? [
    ...benchmarkAdapters,
    registry,
    hosting,
    livebench,
    endpoints,
    featherless,
  ];
  await mkdir(directory, { recursive: true });
  let previous: Dataset;
  try {
    previous = datasetSchema.parse(
      JSON.parse(await readFile(join(directory, "radar.json"), "utf8")),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    previous = {
      schemaVersion: 1,
      refreshedAt: new Date().toISOString(),
      models: [],
      evidence: [],
      variants: [],
      sources: [],
      previousRanks: {},
    };
  }
  let data: Dataset = {
    ...structuredClone(previous),
    decisionPolicyVersion: rankingVersion,
  };
  const checkedAt = new Date().toISOString();
  let successes = 0;
  for (const adapter of adapters) {
    const old = data.sources.find((s) => s.id === adapter.id);
    try {
      const batch = await adapter.run(
        structuredClone(data.models),
        structuredClone(data.variants),
        { evidence: structuredClone(data.evidence) },
      );
      const before = data;
      data = structuredClone(data);
      try {
        if (adapter.id === "openrouter")
          data.models = data.models.map((m) => ({
            ...m,
            providers: m.providers.filter((p) => p.source !== adapter.url),
          }));
        data.models = mergeModels(
          data.models,
          batch.models ?? [],
          batch.replaceProviders,
        );
        if (batch.evidence)
          data.evidence = [
            ...data.evidence.filter((e) => e.sourceId !== adapter.id),
            ...batch.evidence,
          ].sort((a, b) => a.id.localeCompare(b.id));
        if (batch.variants)
          data.variants = [
            ...new Map(
              [...data.variants, ...batch.variants].map((v) => [v.id, v]),
            ).values(),
          ].sort((a, b) => a.id.localeCompare(b.id));
        data.sources = data.sources
          .filter((s) => s.id !== adapter.id)
          .concat({
            id: adapter.id,
            name: adapter.name,
            url: adapter.url,
            status: "ok",
            lastSuccess: checkedAt,
            message: batch.message,
            fingerprint: fingerprint(batch),
          });
        data = datasetSchema.parse(data);
      } catch (error) {
        data = before;
        throw error;
      }
      successes++;
      console.log(`${adapter.id}: ${batch.message}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Source unavailable";
      if (adapter.id === "featherless")
        data.models = data.models.map((m) => ({
          ...m,
          providers: m.providers.map((p) =>
            p.source.startsWith("https://featherless.ai/")
              ? { ...p, checkStatus: "failed" as const }
              : p,
          ),
        }));
      data.sources = data.sources
        .filter((s) => s.id !== adapter.id)
        .concat({
          id: adapter.id,
          name: adapter.name,
          url: adapter.url,
          status: "error",
          lastSuccess: old?.lastSuccess ?? null,
          message: `${message}. Prior valid data retained.`,
          fingerprint: old?.fingerprint,
        });
      console.warn(`${adapter.id}: ${message}`);
    }
  }
  // Fingerprints exclude collector wall-clock metadata, so polling alone never causes commits.
  data.sources = data.sources
    .map((s) => ({ ...s, fingerprint: undefined }))
    .sort((a, b) => a.id.localeCompare(b.id));
  data = datasetSchema.parse(data);
  const changed =
    fingerprint(material(previous)) !== fingerprint(material(data)) ||
    // Evidence aging is material even when every upstream payload is unchanged.
    fingerprint(
      rankModels(previous, Date.parse(previous.refreshedAt)).map((r) => ({
        id: r.id,
        overall: r.overall,
        scores: r.scores,
        coverage: r.coverage,
        rank: r.rank,
      })),
    ) !==
      fingerprint(
        rankModels(data, Date.parse(checkedAt)).map((r) => ({
          id: r.id,
          overall: r.overall,
          scores: r.scores,
          coverage: r.coverage,
          rank: r.rank,
        })),
      );
  await atomic(join(directory, "refresh-status.json"), {
    checkedAt,
    successes,
    total: adapters.length,
    changed,
    sources: data.sources,
  });
  console.log(changed ? "Material data changed." : "No material changes.");
  if (successes === 0)
    throw Error("All sources failed; preserved last valid snapshot");
  if (changed) {
    data.previousRanks = Object.fromEntries(
      rankModels(previous, Date.parse(previous.refreshedAt))
        .filter((r) => r.rank !== null)
        .map((r) => [r.id, r.rank!]),
    );
    data.refreshedAt = checkedAt;
    await atomic(join(directory, "radar.json"), data);
    await atomic(join(directory, "top-ten.json"), {
      rankingVersion,
      checkedAt,
      ...topTen(data, Date.parse(checkedAt)),
    });
    await atomic(join(directory, "decisions.json"), {
      decisionVersion,
      evaluatedAt: checkedAt,
      baselineId,
      candidateId,
      status: "provisional; no direct Windows workflow runs",
      roles: roles.map((role) => {
        const result = sensitivity(
          data,
          baselineId,
          candidateId,
          role,
          { manufacturer: true, published: false, budget: 6 },
          Date.parse(checkedAt),
        );
        return {
          id: role.id,
          weights: role.weights,
          groups: result.groups,
          unstable: result.unstable,
          scenarios: result.scenarios,
          pairedObservationIds: result.pairs.map((p) => [p.a.id, p.b.id]),
        };
      }),
    });
    await atomic(
      join(directory, "rankings.json"),
      rankModels(data, Date.parse(checkedAt)),
    );
  }
  return { changed, data };
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/refresh.ts"))
  await refresh();
