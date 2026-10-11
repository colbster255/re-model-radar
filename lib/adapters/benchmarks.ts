import { z } from "zod";
import { request } from "./http";
import { newModel, type Adapter } from "./types";
import { matchModel } from "../matching";
import { evidenceSchema, safeUrl, type Evidence, type Model } from "../schema";
const raw = "https://raw.githubusercontent.com/";
const known: Record<string, string> = {
  "GLM-5.3": "zai-org/GLM-5.3",
  "GLM-5.2": "zai-org/GLM-5.2",
  "Kimi K3": "moonshotai/Kimi-K3",
  "DeepSeek-V4 Pro-0813": "deepseek-ai/DeepSeek-V4-Pro-0813",
  "Qwen3.8-Max": "Qwen/Qwen3.8-Max",
  "Opus 4.8": "anthropic/claude-opus-4.8",
  "Fable 5 (w/ fallback)": "anthropic/claude-fable-5",
  "GPT-5.6 Sol": "openai/gpt-5.6-sol",
};
function resolve(
  name: string,
  models: Model[],
  source: string,
  family = "Unknown",
) {
  const aliases: Record<string, string> = {
    "Claude 4.6 Opus": "Claude Opus 4.6",
    "Claude 4.5 Opus": "Claude Opus 4.5",
    "Claude 4.5 Sonnet": "Claude Sonnet 4.5",
    "GLM 5": "GLM-5",
    "DeepSeek V3.2": "DeepSeek-V3.2",
  };
  name = aliases[name] || name;
  return (
    matchModel(name, models) ??
    newModel(
      known[name] ??
        `benchmark/${name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-")}`,
      name,
      source,
      family,
    )
  );
}
export const glmCard: Adapter = {
  id: "glm-card",
  name: "Z.ai evaluation table",
  url: "https://huggingface.co/zai-org/GLM-5.3",
  async run(models) {
    const text = z
      .string()
      .parse(
        await request(
          "https://huggingface.co/zai-org/GLM-5.3/raw/main/README.md",
          false,
        ),
      );
    const lines = text.split("\n").filter((l) => l.startsWith("|"));
    const header = lines[0]
      ?.split("|")
      .slice(2, -1)
      .map((x) => x.trim());
    if (!header?.includes("GLM-5.3")) throw Error("Evaluation table changed");
    const discovered = header.map((n) =>
      resolve(
        n,
        models,
        this.url,
        n.startsWith("GLM")
          ? "Z.ai"
          : n.startsWith("Kimi")
            ? "Moonshot AI"
            : "Benchmark comparison",
      ),
    );
    const lookup: Record<string, string> = {
      CyberGym: "cybergym",
      ExploitBench: "exploitbench",
      "DeepSWE (v1.1)": "deepswe",
      "Terminal Bench 2.1": "terminal21",
      "Terminal Bench 3.0": "terminal30",
      "Toolathlon Verified": "toolathlon",
    };
    const evidence: Evidence[] = [];
    for (const line of lines.slice(2)) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((x) => x.replaceAll("**", "").trim());
      const key = lookup[cells[0]];
      if (!key) continue;
      cells.slice(1).forEach((cell, i) => {
        if (!/^\d+(\.\d+)?$/.test(cell) || !discovered[i]) return;
        evidence.push(
          evidenceSchema.parse({
            id: `glm-card:${key}:${discovered[i].id}`,
            modelId: discovered[i].id,
            benchmark: key,
            protocol: `Z.ai GLM-5.3 table / ${key} / see card footnotes`,
            value: Number(cell),
            kind: "manufacturer",
            source: this.url,
            sourceId: this.id,
            observedAt: "2026-08-14T00:00:00Z",
            notes:
              "Manufacturer-reported comparison. Harness details and deviations are in the model card. Not independent verification.",
          }),
        );
      });
    }
    if (evidence.length < 10) throw Error("Incomplete evaluation table");
    return {
      models: discovered,
      evidence,
      message: `${evidence.length} attributed results; no independent claim`,
    };
  },
};
const cyberRow = z.object({
  model: z.string(),
  agent: z.string(),
  source: z.string(),
  source_url: safeUrl.nullable().optional(),
  score_10: z.number().min(0).max(1),
  date: z.string(),
  focus: z.string().optional(),
  model_release_date: z.string().optional(),
});
export const cybergym: Adapter = {
  id: "cybergym",
  name: "CyberGym structured leaderboard",
  url: "https://www.cybergym.io/assets/data/cybergym.json",
  async run(models) {
    const data = z
      .object({ level1: z.array(cyberRow) })
      .parse(await request(this.url));
    const found: Model[] = [],
      evidence: Evidence[] = [];
    for (const [i, r] of data.level1.entries()) {
      if (r.focus === "agent" || r.model.includes("Multi-model")) continue;
      const m = resolve(
        r.model,
        [...models, ...found],
        r.source_url ?? "https://cybergym.io/cybergym/",
        r.source,
      );
      m.releaseDate ??= r.model_release_date ?? null;
      found.push(m);
      const kind =
        r.source === "CyberGym Team"
          ? "independent"
          : /finetuned/i.test(r.model)
            ? "creator"
            : "manufacturer";
      evidence.push(
        evidenceSchema.parse({
          id: `cybergym:${i}:${m.id}`,
          modelId: m.id,
          benchmark: "cybergym",
          protocol: `level1 / ${r.agent} / ${r.source} / pass@1`,
          value: r.score_10 * 100,
          kind,
          source: r.source_url ?? "https://cybergym.io/cybergym/",
          sourceId: this.id,
          observedAt: r.date + "T00:00:00Z",
          notes:
            "Attribution follows the evaluator, not the leaderboard host. Different harnesses are separate cohorts.",
        }),
      );
    }
    return {
      models: found,
      evidence,
      message: `${evidence.length} single-model results; agent-only and multi-model submissions excluded`,
    };
  },
};
export const exploitgym: Adapter = {
  id: "exploitgym",
  name: "ExploitGym structured leaderboard",
  url: "https://www.cybergym.io/assets/data/exploitgym.json",
  async run(models) {
    const row = z.object({
      model: z.string(),
      source: z.string(),
      source_url: safeUrl.nullable().optional(),
      date: z.string(),
      eval_note: z.string(),
      on_target: z.number(),
      version: z.string().optional(),
      focus: z.string().optional(),
      hidden: z.boolean().optional(),
    });
    const data = z
      .object({
        instances: z.object({ total: z.number().positive() }),
        results: z.array(row),
      })
      .parse(await request(this.url));
    const found: Model[] = [],
      evidence: Evidence[] = [];
    for (const [i, r] of data.results.entries()) {
      if (r.hidden || r.focus === "agent" || r.eval_note.includes("subset"))
        continue;
      const name = r.model.replace(/ \(.*$/, "");
      const m = resolve(
        name,
        [...models, ...found],
        r.source_url ?? "https://cybergym.io/exploitgym/",
        r.source,
      );
      found.push(m);
      evidence.push(
        evidenceSchema.parse({
          id: `exploitgym:${i}:${m.id}`,
          modelId: m.id,
          benchmark: "exploitgym",
          protocol: `${r.version ?? "unspecified"} / ${r.eval_note} / ${data.instances.total} tasks`,
          value: (r.on_target / data.instances.total) * 100,
          kind: r.source === "ExploitGym Team" ? "independent" : "manufacturer",
          source: r.source_url ?? "https://cybergym.io/exploitgym/",
          sourceId: this.id,
          observedAt: r.date + "T00:00:00Z",
          notes:
            "Linux userspace, V8 and kernel tasks; not a Windows or anti-cheat evaluation. Collaborative vendor runs remain manufacturer-reported.",
        }),
      );
    }
    return {
      models: found,
      evidence,
      message: `${evidence.length} version/budget-specific results`,
    };
  },
};
export const swe: Adapter = {
  id: "swe",
  name: "SWE-bench Multilingual",
  url: raw + "SWE-bench/swe-bench.github.io/master/data/leaderboards.json",
  async run(models) {
    const row = z.object({
      model_display: z.string(),
      model_org: z.string(),
      agent: z.string(),
      agent_org: z.string(),
      resolved: z.number().min(0).max(100),
      date: z.string(),
      site: safeUrl,
      os_model: z.boolean(),
      checked: z.boolean().nullable(),
      "mini-swe-agent_version": z.string().optional(),
    });
    const data = z
      .object({
        leaderboards: z.array(
          z.object({ name: z.string(), results: z.array(z.unknown()) }),
        ),
      })
      .parse(await request(this.url));
    const found: Model[] = [],
      evidence: Evidence[] = [];
    for (const input of data.leaderboards.find((b) => b.name === "Multilingual")
      ?.results ?? []) {
      const r = row.parse(input);
      if (r.agent_org !== "SWE-agent" || r.checked !== true) continue;
      const m = resolve(
        r.model_display,
        [...models, ...found],
        r.site,
        r.model_org,
      );
      m.openWeight = r.os_model;
      found.push(m);
      evidence.push(
        evidenceSchema.parse({
          id: `swe:${m.id}`,
          modelId: m.id,
          benchmark: "swe-multilingual",
          protocol: `mini-SWE-agent ${r["mini-swe-agent_version"]} / Multilingual`,
          value: r.resolved,
          kind: "independent",
          source: "https://www.swebench.com",
          sourceId: this.id,
          observedAt: r.date + "T00:00:00Z",
          notes:
            "Benchmark-team mini-SWE-agent runs only. Broad repository engineering proxy, not dedicated C++/Windows evidence.",
        }),
      );
    }
    return {
      models: found,
      evidence,
      message: `${evidence.length} checked benchmark-team runs`,
    };
  },
};
export const terminal: Adapter = {
  id: "terminal",
  name: "Terminal-Bench 4.0",
  url: "https://github.com/harbor-framework/terminal-bench/tree/main/leaderboard/submissions",
  async run(models) {
    const tree = z
      .array(z.object({ path: z.string(), type: z.string() }))
      .parse(
        await request(
          "https://api.github.com/repos/harbor-framework/terminal-bench/contents/leaderboard/submissions",
        ),
      );
    const found: Model[] = [],
      evidence: Evidence[] = [];
    const label = z.object({ label: z.string(), url: safeUrl });
    const schema = z.object({
      metadata: z.object({
        model_display: label,
        model_org: label,
        agent_org: label,
        agent_display: label,
        date: z.string(),
        reasoning_effort: z.string(),
      }),
      metrics: z.object({
        accuracy: z.number().min(0).max(100),
        n_trials: z.number().positive(),
      }),
      source_filter: z
        .object({
          model_name: z.string(),
          agent_version: z.string().optional(),
        })
        .optional(),
    });
    // All current official submissions, schema-validated; unknown schemas fail the batch safely.
    for (const item of tree
      .filter((x) => x.type === "file" && x.path.endsWith(".json"))
      .slice(-100)) {
      const r = schema.parse(
        await request(
          raw + "harbor-framework/terminal-bench/main/" + item.path,
        ),
      );
      const a = r.metadata;
      const m = resolve(
        a.model_display.label,
        [...models, ...found],
        a.model_display.url,
        a.model_org.label,
      );
      found.push(m);
      evidence.push(
        evidenceSchema.parse({
          id: `terminal:${item.path}`,
          modelId: m.id,
          benchmark: "terminal40",
          protocol: `v4.0.0 / ${a.agent_display.label} ${r.source_filter?.agent_version ?? ""} / ${a.reasoning_effort}`,
          value: r.metrics.accuracy,
          kind: "unverified",
          source:
            "https://github.com/harbor-framework/terminal-bench/blob/main/" +
            item.path,
          sourceId: this.id,
          observedAt: a.date + "T00:00:00Z",
          notes: `${r.metrics.n_trials} trials. Official published submission, but the structured file identifies the agent vendor, not the evaluator. Independence is unverified; retained as an observation and excluded from scoring.`,
        }),
      );
    }
    return {
      models: found,
      evidence,
      message: `${evidence.length} official submissions, separated by harness and effort`,
    };
  },
};
export const benchmarkAdapters = [glmCard, cybergym, exploitgym, swe, terminal];
