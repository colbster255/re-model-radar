import { readFile, writeFile } from "node:fs/promises";
import { hash, manifestSchema } from "../lib/workflow-eval";
// Config is supplied after real MCP schema export and fixture preparation; no external actions.
const [path] = process.argv.slice(2);
if (!path) throw Error("Usage: npm run eval:prepare -- manifest-input.json");
const input = JSON.parse(await readFile(path, "utf8"));
const manifest = manifestSchema.parse({
  ...input,
  version: "1.0",
  status: "unrun",
  toolSchemaHash: hash(input.tools),
});
await writeFile(
  "evals/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  `Pinned offline manifest: ${hash(manifest)}. Evaluation remains unrun.`,
);
