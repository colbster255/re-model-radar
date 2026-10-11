import { evidenceSchema, type Evidence } from "./schema";

export const cardMetrics: Record<string, string> = {
  "Terminal Bench 2.1": "terminal21",
  "Terminal Bench 3.0": "terminal30",
  "DeepSWE (v1.1)": "deepswe",
  NL2Repo: "nl2repo",
  "ProgramBench (Almost Solved)": "programbench",
  FrontierSWE: "frontierswe",
  "SWE-Marathon (v1.1)": "swe-marathon",
  PostTrainBench: "posttrain",
  CyberGym: "cybergym",
  ExploitBench: "exploitbench",
  "Toolathlon Verified": "toolathlon",
  "AutomationBench (v1.0.6)": "automation",
  "Agents' Last Exam (ALE-CLI)": "ale",
  "HLE w/ Tools": "hle-tools",
};
// Counts are not percentages. Fail closed rather than accept a changed denominator/budget.
export function exploitCounts(cell: string) {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(cell);
  if (!m || m.slice(1).some((n) => Number(n) > 869))
    throw Error("Invalid ExploitGym counts");
  return [Number(m[1]), Number(m[2])];
}
export function parseCard(
  text: string,
  identities: (string | undefined)[],
  checkedAt: string,
): Evidence[] {
  const lines = text.split("\n").filter((l) => l.startsWith("|"));
  const out: Evidence[] = [];
  for (const line of lines.slice(2)) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((s) => s.replaceAll("**", "").trim());
    const exploit = cells[0] === "ExploitGym (2h / 6h)";
    const key = exploit ? "exploitgym" : cardMetrics[cells[0]];
    if (!key) continue; // GDPval is a rating, not a percentage; excluded explicitly in audit.
    cells.slice(1).forEach((cell, i) => {
      const modelId = identities[i];
      if (!modelId || /^[–—-]$/.test(cell)) return;
      if (!exploit && !/^\d+(\.\d+)?$/.test(cell)) return;
      const values = exploit ? exploitCounts(cell) : [Number(cell)];
      values.forEach((rawValue, j) => {
        const budgetHours = exploit ? [2, 6][j] : undefined;
        // The card explicitly documents a common ExploitGym protocol for these three models only.
        const matched =
          exploit &&
          [
            "zai-org/GLM-5.3",
            "moonshotai/Kimi-K3",
            "Qwen/Qwen3.8-Max",
          ].includes(modelId);
        out.push(
          evidenceSchema.parse({
            id: `glm-card:v3:${key}:${budgetHours ?? "default"}:${modelId}`,
            modelId,
            benchmark: key,
            protocol: `Z.ai card v3 / ${key} / ${budgetHours ?? "published"}${exploit ? "h / Claude Code 2.1.207 / max / 128000 output / 869 / TPS-rescaled" : " / published settings; peer budgets not established"}`,
            value: exploit ? (rawValue / 869) * 100 : rawValue,
            rawValue,
            denominator: exploit ? 869 : undefined,
            metric: exploit
              ? "count"
              : key === "exploitbench"
                ? "coverage"
                : "percentage",
            budgetHours,
            correlationGroup: "zai-card-publication",
            comparability: matched
              ? "matched"
              : exploit
                ? "unresolved"
                : "published",
            kind: "manufacturer",
            sourceId: "glm-card",
            source: "https://huggingface.co/zai-org/GLM-5.3",
            observedAt: checkedAt,
            checkedAt,
            notes:
              "Manufacturer report; checked date is retrieval, individual run dates unknown. " +
              (exploit
                ? "Single-run successes / 869; API inference time rescaled at GLM 115, Kimi 40, Qwen 47 TPS plus non-API overhead. Not Featherless wall-clock latency. "
                : "Same table does not establish matched peer effort, harness and resource budgets. ") +
              "See card footnotes for benchmark-specific harness/context/time/output and modified evaluation conditions. No Windows workflow evaluation.",
          }),
        );
      });
    });
  }
  if (out.length < 10) throw Error("Incomplete evaluation table");
  return out;
}
