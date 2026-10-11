import { readFile, mkdir, writeFile } from "node:fs/promises";
import { admit } from "../lib/workflow-eval";
// Deliberately offline. No provider API, process execution or debugger connection exists here.
const [manifestPath, recordPath] = process.argv.slice(2);
if (!manifestPath || !recordPath)
  throw Error(
    "Usage: npm run eval:record -- manifest.json run.json (offline only)",
  );
const result = admit(
  JSON.parse(await readFile(manifestPath, "utf8")),
  JSON.parse(await readFile(recordPath, "utf8")),
);
await mkdir("evals/runs", { recursive: true });
await writeFile(
  `evals/runs/${result.run.id}.json`,
  JSON.stringify(result, null, 2) + "\n",
  { flag: "wx" },
);
console.log(JSON.stringify(result.report, null, 2));
