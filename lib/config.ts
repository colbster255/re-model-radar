export const weights = {
  cyber: 30,
  coding: 25,
  systems: 20,
  agentic: 15,
  deployment: 10,
} as const;
export type Category = keyof typeof weights;
export const categories = Object.keys(weights) as Category[];
export const policy = {
  minimumCoverage: 70,
  minimumIndependentCategories: 2,
  maxEvidenceAgeDays: 365,
};
export const benchmarks: Record<
  string,
  { category: Category; label: string; protocol: string }
> = {
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
  "swe-multilingual": {
    category: "coding",
    label: "SWE-bench Multilingual",
    protocol: "mini-SWE-agent / multilingual",
  },
};
