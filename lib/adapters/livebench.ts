import ts from "typescript";
import { z } from "zod";
import { request } from "./http";
import { matchModel } from "../matching";
import { newModel, type Adapter } from "./types";
import { evidenceSchema, safeUrl, type Model } from "../schema";

// Read literal metadata with a syntax tree. Never import or execute remote JavaScript.
export function readModelMetadata(text: string) {
  const file = ts.createSourceFile(
    "metadata.js",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const entries = new Map<string, Record<string, unknown>>();
  const literal = (node: ts.Expression): unknown => {
    if (ts.isStringLiteral(node)) return node.text;
    if (
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.ExclamationToken &&
      ts.isNumericLiteral(node.operand) &&
      ["0", "1"].includes(node.operand.text)
    )
      return node.operand.text === "0";
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (ts.isArrayLiteralExpression(node))
      return node.elements.map((n) => literal(n as ts.Expression));
    if (ts.isObjectLiteralExpression(node))
      return Object.fromEntries(
        node.properties.flatMap((p) =>
          ts.isPropertyAssignment(p) &&
          (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
            ? [[p.name.text, literal(p.initializer)]]
            : [],
        ),
      );
    return undefined;
  };
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      for (const p of node.properties) {
        if (
          ts.isPropertyAssignment(p) &&
          (ts.isStringLiteral(p.name) || ts.isIdentifier(p.name)) &&
          ts.isObjectLiteralExpression(p.initializer)
        ) {
          const info = literal(p.initializer) as Record<string, unknown>;
          if (typeof info.displayName === "string")
            entries.set(p.name.text, info);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!entries.size) throw Error("LiveBench model metadata contract changed");
  return entries;
}
export function readTable(text: string) {
  // Current feed is an unquoted numeric CSV. Fail closed if its contract changes.
  if (text.includes('"')) throw Error("LiveBench CSV quoting changed");
  const [header, ...lines] = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(","));
  if (header[0] !== "model" || new Set(header).size !== header.length)
    throw Error("Invalid LiveBench header");
  return lines.map((cells) => {
    if (cells.length !== header.length) throw Error("Incomplete LiveBench row");
    return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
  });
}
const aliases: Record<string, string> = {
  "gpt-5.6-sol-max": "openai/gpt-5.6-sol",
  "claude-fable-5-max-effort": "anthropic/claude-fable-5",
  "claude-opus-4-8-max-effort": "anthropic/claude-opus-4.8",
  "claude-opus-4-6-thinking-auto-high-effort": "benchmark/claude-opus-4.6",
  "claude-opus-5-5-xhigh-effort": "anthropic/claude-opus-5.5",
  "claude-fable-5-1-max-effort": "anthropic/claude-fable-5.1",
  "gpt-6-sol-max": "benchmark/gpt-6-sol",
  "gpt-6-luna-max": "benchmark/gpt-6-luna",
  "gpt-6.1-sol-max": "benchmark/gpt-6.1-sol",
  "gpt-6-astra-max": "openai/gpt-6-astra",
};
export function discoverRelease(asset: string) {
  // Publisher release IDs in literal arrays, read as data. No remote JS executes.
  const dates = [...asset.matchAll(/(?:\[|,)\s*"(20\d{6})"\s*(?=,|\])/g)]
    .map((m) => m[1])
    .sort();
  if (!dates.length) throw Error("LiveBench release manifest changed");
  return dates.at(-1)!;
}
export const livebench: Adapter = {
  id: "livebench",
  name: "LiveBench 2.0 published task results",
  url: "https://livebench.ai/",
  async run(models) {
    const html = z.string().parse(await request(this.url, false));
    const src = /<script[^>]+src="([^"]+\.js)"/.exec(html)?.[1];
    if (!src) throw Error("LiveBench script manifest missing");
    const assetUrl = new URL(src, this.url);
    if (assetUrl.origin !== new URL(this.url).origin)
      throw Error("Unexpected metadata host");
    const asset = z.string().parse(await request(assetUrl.href, false));
    const release = discoverRelease(asset);
    const root = this.url + "data/" + release + "/";
    const [csv, groups, notes] = await Promise.all([
      request(root + "table.csv", false),
      request(root + "categories.json"),
      request(root + "notes.json"),
    ]);
    const categories = z
      .record(z.string(), z.array(z.string()))
      .parse(
        Object.fromEntries(
          Object.entries(
            z.record(z.string(), z.unknown()).parse(groups),
          ).filter(([k]) => !k.startsWith("_")),
        ),
      );
    const meta = readModelMetadata(asset);
    const table = readTable(z.string().parse(csv));
    const found: Model[] = [],
      evidence = [];
    const observedAt = `${release.slice(0, 4)}-${release.slice(4, 6)}-${release.slice(6, 8)}T00:00:00Z`;
    const definitions = [
      ["Reasoning", "lb2-reasoning"],
      ["Coding", "lb2-coding"],
      ["Long Agentic", "lb2-agentic"],
      ["Design", "lb2-design"],
    ] as const;
    for (const row of table) {
      const info = meta.get(row.model);
      if (!info || typeof info.displayName !== "string") continue;
      const hf =
        typeof info.huggingface === "string" &&
        /^https:\/\/huggingface\.co\/[\w.-]+\/[\w.-]+\/?$/.test(
          info.huggingface,
        )
          ? info.huggingface.replace(/\/$/, "")
          : undefined;
      const existing = hf
        ? models.find(
            (m) =>
              m.id.toLowerCase() ===
              new URL(hf).pathname.slice(1).toLowerCase(),
          )
        : (matchModel(
            info.displayName,
            models.filter((m) => !m.id.startsWith("livebench/")),
          ) ?? models.find((m) => m.id === `livebench/${row.model}`));
      const card =
        hf ??
        (safeUrl.safeParse(info.url).success ? String(info.url) : this.url);
      const m =
        existing ??
        newModel(
          hf
            ? new URL(hf).pathname.slice(1)
            : (aliases[row.model] ?? `livebench/${row.model}`),
          info.displayName,
          card,
          String(info.organization ?? "LiveBench"),
          info.openweight === true,
        );
      const model = {
        ...m,
        name: info.displayName,
        openWeight: info.openweight === true,
        card,
      };
      found.push(model);
      for (const [category, benchmark] of definitions) {
        const columns = categories[category];
        if (!columns?.length) continue;
        const values = columns.map((c) =>
          ["", "-", "n/a"].includes(row[c]?.trim() ?? "")
            ? null
            : z.coerce.number().min(0).max(100).parse(row[c]),
        );
        if (values.some((v) => v === null)) continue;
        evidence.push(
          evidenceSchema.parse({
            id: `livebench2:${release}:${benchmark}:${model.id}`,
            modelId: model.id,
            benchmark,
            protocol: `LiveBench 2.0 / ${release} / ${category} / published configuration`,
            value:
              (values as number[]).reduce((a, b) => a + b, 0) / values.length,
            kind: "independent",
            source: root + "table.csv",
            sourceId: this.id,
            observedAt,
            correlationGroup: `livebench2:${release}`,
            comparability: "published",
            metric: "percentage",
            notes: `Configuration ${row.model}; effort ${info.effort ?? "publisher default"}. ${z.array(z.string()).parse(notes).join(" ")} Publication release date, not per-model run date. No direct Windows RE or creative problem-solving validation.`,
          }),
        );
      }
    }
    if (found.filter((m) => m.openWeight).length < 3 || evidence.length < 9)
      throw Error("Incomplete latest LiveBench open-weight cohort");
    return {
      models: found,
      evidence,
      message: `LiveBench 2.0 release ${release}: ${found.length} models, ${evidence.length} results. Latest published release discovered from the live site's manifest; distinct from LiveBench 1.0.`,
    };
  },
};
