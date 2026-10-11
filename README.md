# RE Model Radar

A source-linked decision workspace for choosing cloud models for a Windows reverse-engineering workflow. LibreChat + Featherless is primary. One Director plans, delegates and writes C/C++; four specialists use IDA, x64dbg, WinDbg and Cheat Engine. GLM-5.3 is the current baseline; Kimi K3 is a candidate.

## Run and verify

Node 24 recommended (22+ supported).

```sh
npm ci
npm run refresh
npm run dev
npm run check
```

## Current policy: 3.0.0

The default dashboard provides six task views for five agents, raw paired results, cohort percentile context, independent-only/manufacturer controls, budget and weight sensitivity, practical hosting and an unrun evaluation specification. There is no measured Windows competence score or authoritative overall #1. See [the audit](docs/workflow-audit-v3.md) for the calculation, previous distortions and uncertain conclusions.

`lib/decisions.ts` uses exact protocol/source/attribution/budget/metric cohorts. Raw differences, not percentile differences, enter an editorial evidence balance. Related categories are averaged within a publication and that publication's influence is capped. Missing evidence is unknown. Manufacturer reports are visibly separate. Unmatched published peer resources remain descriptive unless explicitly explored. Weight/source/budget instability is exposed; no statistical intervals or probabilities are invented.

`data/radar.json` preserves observations, source provenance, checkpoint metadata and provider profiles. `data/decisions.json` exports versioned default workflow decisions. `data/rankings.json` remains a legacy v2 export for compatibility; it is not the current recommendation policy. The original pre-change snapshots are preserved under `data/archive/`. The optional Archived v2 UI is audit-only. Modified checkpoints never inherit measured base capability.

## Sources and hosting

Adapters ingest official CyberGym/ExploitGym/SWE-bench/Terminal-Bench data, LiveBench published configurations, the manufacturer GLM card, Hugging Face registry metadata and public OpenRouter/Featherless catalogs. Markdown is parsed as data, never executed. Discovery is bounded, not comprehensive. Sources/harnesses/effort differ; sharing a leaderboard does not establish independence or equal resources. Terminal submissions with unverified evaluator identity remain descriptive.

ExploitGym card counts are ingested separately for 2h/6h with denominator 869, manufacturer attribution and throughput-rescaling caveats. Coverage, counts and percentages remain distinct. Card run dates are unknown; the date is explicitly retrieval. The Kimi model card is reviewed for controls/history requirements, not spliced into an incompatible GLM-5.3 comparison.

Exact variant hosting is distinct from base hosting. Featherless exact active catalog searches are bounded to 200 variants at concurrency five; public detail lookups cover the GLM/Kimi base pair. The public frontend API is used because the documented model-list endpoint returned Gone during the audit. OpenRouter interactive and batch routes coexist. Provider limits/pricing are declared, not practically validated. Plan access, actual serving, latency and task cost remain unknown; no GPU weights are deployed locally.

Registry weight artifacts/access, lineage, hosting, comparable retention, tool reliability and refusal/compliance are separate. Variants without workflow validation are experimental. Reduced refusal does not establish better technical competence.

## Evaluation framework

See [evals/README.md](evals/README.md). The framework is offline and all workflow evaluations are **unrun**. It includes task prompts, budgets, purpose-built Windows sources, known answers, real-schema hash pinning, per-run record admission and separate objective/qualitative dimensions. Actual MCP schema exports and prepared fixture binaries/dumps are required before admission. It performs no paid inference, debugger connection, LibreChat edits or migration.

## Deployment and refresh

Production uses the existing Vercel Git integration, branch `main`, Node 24. GitHub Actions refreshes public sources hourly using built-in `GITHUB_TOKEN`; optional `HF_TOKEN` may be supplied only as a secret for gated metadata. No runtime secrets or paid inference are required. Schedules can be delayed; source status and workflow checks are displayed separately from material snapshot dates.

Adapters validate atomically and retain last-known-good observations on failure. All-source failure preserves the snapshot and fails the job. Provider check timestamps alone do not count as content changes. Unchanged card retrieval does not silently change evaluation dates. Source errors, changed content and evidence expiration are material changes. External metadata uses HTTPS allowlists, schemas, bounds, timeouts, retries and escaped React rendering.

The existing visual theme follows the open-source [shadcn/ui Neutral dashboard](https://ui.shadcn.com/blocks?category=dashboard): zinc surfaces, restrained borders, emerald accents, native accessible controls and responsive layouts.
