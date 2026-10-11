import ts from "typescript";
import { z } from "zod";
import { request } from "./http";
import { newModel, type Adapter } from "./types";
import { evidenceSchema, safeUrl, type Model } from "../schema";

const root = "https://raw.githubusercontent.com/LiveBench/new-livebench/main/";
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
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "modelLinks" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const p of node.initializer.properties)
        if (
          ts.isPropertyAssignment(p) &&
          ts.isStringLiteral(p.name) &&
          ts.isObjectLiteralExpression(p.initializer)
        )
          entries.set(
            p.name.text,
            literal(p.initializer) as Record<string, unknown>,
          );
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
export const livebench: Adapter = {
  id: "livebench",
  name: "LiveBench reasoning, coding & agentic tasks",
  url: "https://livebench.ai/new-livebench/",
  async run(models) {
    const tree = z
      .array(z.object({ name: z.string() }))
      .parse(
        await request(
          "https://api.github.com/repos/LiveBench/new-livebench/contents/public",
        ),
      );
    const release = tree
      .map((f) => /^table_(\d{4}_\d{2}_\d{2})\.csv$/.exec(f.name)?.[1])
      .filter((s): s is string => Boolean(s))
      .sort()
      .at(-1);
    if (!release) throw Error("No LiveBench release");
    const path = `public/table_${release}.csv`;
    const [csv, groups, metadata, commits] = await Promise.all([
      request(root + path, false),
      request(root + `public/categories_${release}.json`),
      request(root + "src/Table/modelLinks.js", false),
      request(
        `https://api.github.com/repos/LiveBench/new-livebench/commits?path=${encodeURIComponent(path)}&per_page=1`,
      ),
    ]);
    const categories = z
      .record(z.string(), z.array(z.string()).min(1))
      .parse(groups);
    const observedAt = z
      .array(
        z.object({
          commit: z.object({ committer: z.object({ date: z.iso.datetime() }) }),
        }),
      )
      .parse(commits)[0]?.commit.committer.date;
    if (!observedAt) throw Error("Missing LiveBench publication date");
    const meta = readModelMetadata(z.string().parse(metadata));
    const table = readTable(z.string().parse(csv));
    const found: Model[] = [],
      evidence = [];
    const definitions = [
      ["Reasoning", "livebench-reasoning"],
      ["Coding", "livebench-coding"],
      ["Agentic Coding", "livebench-agentic"],
    ] as const;
    for (const [key, info] of meta) {
      if (
        Object.hasOwn(info, "finetune") ||
        typeof info.displayName !== "string"
      )
        continue;
      const variants = z
        .array(z.object({ rawName: z.string() }))
        .safeParse(info.variants);
      // Use the publisher's default configuration, falling back to its first listed available variant.
      const row =
        table.find((r) => r.model === key) ??
        (variants.success
          ? variants.data
              .map((v) => table.find((r) => r.model === v.rawName))
              .find(Boolean)
          : undefined);
      if (!row) continue;
      const hf =
        typeof info.huggingface === "string" &&
        /^https:\/\/huggingface\.co\/[\w.-]+\/[\w.-]+\/?$/.test(
          info.huggingface,
        )
          ? info.huggingface.replace(/\/$/, "")
          : undefined;
      const id = hf
        ? new URL(hf).pathname.slice(1)
        : (aliases[key] ?? `livebench/${key}`);
      const existing = models.find(
        (m) => m.id.toLowerCase() === id.toLowerCase(),
      );
      const card =
        hf ??
        (safeUrl.safeParse(info.url).success ? (info.url as string) : this.url);
      const model = existing
        ? {
            ...existing,
            name: /fallback/i.test(existing.name)
              ? info.displayName
              : existing.name,
          }
        : newModel(
            id,
            info.displayName,
            card,
            typeof info.organization === "string"
              ? info.organization
              : "LiveBench catalog",
            info.openweight === true,
          );
      found.push(model);
      for (const [category, benchmark] of definitions) {
        const columns = categories[category];
        if (!columns) throw Error(`Missing LiveBench ${category}`);
        const values = columns.map((c) =>
          row[c] === undefined || row[c].trim() === "" || row[c] === "-"
            ? null
            : z.coerce.number().min(0).max(100).parse(row[c]),
        );
        if (values.some((v) => v === null)) continue;
        evidence.push(
          evidenceSchema.parse({
            id: `livebench:${release}:${benchmark}:${id}`,
            modelId: id,
            benchmark,
            protocol: `LiveBench ${release} / ${category} / published default configurations`,
            value:
              (values as number[]).reduce((a, b) => a + b, 0) / values.length,
            kind: "independent",
            source: root + path,
            sourceId: this.id,
            observedAt,
            notes: `Configuration: ${row.model}. Subtasks: ${columns.join(", ")}. Publication timestamp, not evaluation date. Effort differs between models; a general-purpose RE proxy, not a Windows/disassembly or tool-call correctness test.`,
          }),
        );
      }
    }
    if (found.length < 3) throw Error("Incomplete LiveBench cohort");
    return {
      models: found,
      evidence,
      message: `${found.length} models / ${evidence.length} independent category observations; release ${release}. General reasoning/coding proxies, not direct RE validation.`,
    };
  },
};
