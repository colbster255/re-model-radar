export const weights = {
  cyber: 30,
  coding: 25,
  systems: 20,
  agentic: 15,
  deployment: 10,
} as const;
export type Category = keyof typeof weights;
export type ScoreCategory = Category | "reasoning";
export const categories = Object.keys(weights) as Category[];
export const policy = {
  minimumCoverage: 70,
  minimumIndependentCategories: 2,
  maxEvidenceAgeDays: 365,
};
export const benchmarks: Record<
  string,
  { category: ScoreCategory; label: string; protocol: string }
> = {
  "livebench-reasoning": {
    category: "reasoning",
    label: "LiveBench Reasoning",
    protocol:
      "release-specific reasoning subtask mean / published effort configuration",
  },
  "livebench-coding": {
    category: "coding",
    label: "LiveBench Coding",
    protocol: "release-specific code generation/completion mean",
  },
  "livebench-agentic": {
    category: "agentic",
    label: "LiveBench Agentic Coding",
    protocol: "release-specific JavaScript/TypeScript/Python task mean",
  },
  terminal40: {
    category: "agentic",
    label: "Terminal-Bench 4.0",
    protocol: "official v4.0.0 / accuracy / harness-specific",
  },
  exploitgym: {
    category: "cyber",
    label: "ExploitGym",
    protocol: "on-target / 869 tasks / version and budget specific",
  },
  cybergym: {
    category: "cyber",
    label: "CyberGym",
    protocol: "pass@1 / 1,507 tasks",
  },
  exploitbench: {
    category: "cyber",
    label: "ExploitBench",
    protocol: "coverage / 41 tasks / 3 revisions",
  },
  deepswe: {
    category: "coding",
    label: "DeepSWE v1.1",
    protocol: "mini-swe-agent / 6h / 400K",
  },
  terminal21: {
    category: "agentic",
    label: "Terminal-Bench 2.1",
    protocol: "Claude Code 2.1.207 / 6h",
  },
  terminal30: {
    category: "agentic",
    label: "Terminal-Bench 3.0",
    protocol: "Claude Code 2.1.207 / avg@3 / 10h",
  },
  toolathlon: {
    category: "agentic",
    label: "Toolathlon Verified",
    protocol: "official service / pass@1 / avg@3",
  },
  nl2repo: {
    category: "coding",
    label: "NL2Repo",
    protocol: "Z.ai published comparison; see footnotes",
  },
  programbench: {
    category: "coding",
    label: "ProgramBench Almost Solved",
    protocol: "Z.ai published comparison; see footnotes",
  },
  frontierswe: {
    category: "coding",
    label: "FrontierSWE",
    protocol: "Z.ai published comparison; see footnotes",
  },
  "swe-marathon": {
    category: "coding",
    label: "SWE-Marathon v1.1",
    protocol: "Z.ai published comparison; see footnotes",
  },
  posttrain: {
    category: "agentic",
    label: "PostTrainBench",
    protocol: "Z.ai published comparison; see footnotes",
  },
  automation: {
    category: "agentic",
    label: "AutomationBench v1.0.6",
    protocol: "Z.ai published comparison; see footnotes",
  },
  ale: {
    category: "agentic",
    label: "Agents Last Exam CLI",
    protocol: "Z.ai published comparison; see footnotes",
  },
  "hle-tools": {
    category: "reasoning",
    label: "HLE with tools",
    protocol: "Z.ai published comparison; see footnotes",
  },
  "swe-multilingual": {
    category: "coding",
    label: "SWE-bench Multilingual",
    protocol: "mini-SWE-agent / multilingual",
  },
};
