# Goal alignment audit — 2026-10-11 (09:00 ET baseline)

RE Model Radar follows the requested evidence-first design. The main remaining gap is evaluation coverage, rather than a demonstrated best model for Windows security research. At this baseline, no model met the qualification policy, and matched variants had no comparable capability-retention measurements. These gaps remain visible throughout the dashboard.

## Corrections made

| Finding | Correction |
| --- | --- |
| Windows native sort popup combined pale text with a white surface | Explicit opaque dark select/option backgrounds and near-white text; visible keyboard focus. Browser computed styles confirm all four options use `#18181b` / `#fafafa`. Native OS popup surfaces are excluded from browser page screenshots. |
| Secondary text had weak contrast | Raised secondary text to the shared readable neutral color. |
| Variant choice rewarded test quantity irrespective of retained performance | Independent evidence takes precedence; within an evidence tier, compare the weakest measured ratio, distinct test coverage, then declared tool support. Ratios above parity cannot dominate selection. No aggregate retention percentage is published. |
| Any structured metric could be interpreted as capability retention | Restrict ingestion to recognized coding/cyber/reasoning categories and higher-is-better accuracy/success metrics. Refusal/compliance, loss and perplexity are excluded. Exact evaluation conditions remain required. |
| Matching display names could overwrite another publisher's metadata | Hugging Face updates require exact repository IDs. OpenRouter's explicit repository IDs cannot fall back to another publisher's display name. Ambiguous display-name matches are rejected. |
| Manufacturer table included a fallback-assisted model result | Exclude fallback/multi-model columns from ingestion and mixed-model entries from the base-model leaderboard. Six manufacturer observations were removed in the refresh. |
| Future-dated and conflicting duplicate observations could affect scores | Reject future observations; choose the newest duplicate deterministically. Future releases no longer receive a NEW tag. |
| Static rankings could outlive the evidence-age policy | Expiration counts as a material ranking change; hourly page revalidation also reevaluates age when requested. |
| Invalid adapter batches and total outages were insufficiently isolated | Clone adapter inputs, validate each staged batch, preserve other healthy updates, and leave versioned snapshots untouched if every source fails. |
| Header implied live operational status from stored source health | Label stored health as snapshot health; show the latest failed workflow separately. |
| Retention copy implied coding/RE proof for every benchmark | Use measured benchmark retention, avoid `Unverified%`, and distinguish measurements from missing comparable tests. |
| Client received the entire catalog twice | Send ranked rows plus only the source/evidence/variant metadata used by the client. |

## Requirements checked

| Goal | Assessment |
| --- | --- |
| Base models first; exact variant lineage | Implemented. Available files and declared exact lineage are necessary. Audnai's missing lineage prevents automatic selection; its candidate remains visible for review. |
| Cyber 30 / coding 25 / systems 20 / agentic 15 / deployment 10 | Configurable in `lib/config.ts`. Missing categories reduce coverage instead of becoming zero. |
| No unsupported #1 | Implemented: at least 70% weighted coverage, two independent categories including cyber. Current qualified count is zero. |
| Normalize unlike evaluations and preserve provenance | Cohort percentiles require three distinct models and matching source, harness/protocol and attribution. Independent results take precedence per benchmark. Raw scores, normalized scores, dates and sources appear in details. |
| Separate refusal reduction from capability | Implemented. Creator HarmBench compliance is labeled as compliance; it is neither coding retention nor measured refusal reduction. |
| Search, four filters, four sorts, 15 initial rows, detail dialog, methodology, sources | Implemented. Native select retains platform keyboard behavior. Dialog uses native focus containment and Escape dismissal. |
| Automatic discovery and update | Seven adapters refreshed successfully during this audit. Discovery is publisher-agnostic but bounded. Existing GitHub hourly/manual workflow and Vercel Git deployment remain in use. No-change polls avoid data commits; expiration is material. |
| Last-known-good and rate-limit handling | Meaningful regressions cover partial outages, complete outages, malformed batches, unchanged polling and evidence expiration. HTTPS host allowlist, timeouts and limited retries are present. |
| No paid inference or unnecessary account system | Implemented. No user accounts, database or paid inference are required. Optional collector credentials remain server-side. |

## Evidence limits that remain

- Current feeds do not directly validate Windows kernel/user-mode research, Vanguard, assembly, IDA, Ghidra, WinDbg or x64dbg competence. Systems/RE stays unscored; Linux security and coding results are proxies.
- Deployment listings and context lengths are declared metadata. They do not establish inference uptime, tool-call correctness, practical context or local memory requirements.
- No ingested exact-lineage variant currently has comparable capability-retention evidence. Selection therefore identifies a candidate, not a demonstrated best variant. Weight-file listings and registry lineage are not forensic verification.
- Discovery is bounded, not exhaustive. New benchmark types need a reviewed adapter and normalization policy. Scheduled GitHub runs may be delayed; workflow history is the operational record.
- Provisional percentiles can move when evaluated peer cohorts change. They are not universal accuracy percentages or measured Windows competence.

## Verification

The audited flow is public feeds → validated adapters → versioned snapshot → normalized rankings → dashboard, with browser → `/api/status` → public GitHub workflow status for refresh reporting.

- All seven production adapters completed successfully; the snapshot contains 133 source-linked observations after excluding the fallback-assisted column.
- 23 automated regressions pass, covering scoring, missing evidence, manufacturer qualification, cohort isolation, duplicate/future evidence, exact matching, retention and collector recovery.
- ESLint, TypeScript and production compilation are checked before publication. The production route declares hourly revalidation.
- Browser checks cover sorting with keyboard input, search and empty results, filters, details, source provenance and unverified variant measurements. Deployment and responsive verification are recorded in the completion report.

CSS behavior reference: [MDN option styling](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/option#styling_with_css).

## Follow-up: four capabilities for reverse engineering

The subsequent task-focused view adds thinking/reasoning, coding, reversing (security proxy) and tool-use (agentic execution proxy) shortlists, corresponding table columns/sorts, and per-model workflow explanations with source links. LiveBench is now the eighth adapter and supplied 180 independent category observations across 60 default model configurations on its first refresh. Qualification can change as this evidence is added; the live dashboard shows the current result. Reasoning remains separate from the original overall weighting and qualification gate.

Shortlists compare one shared benchmark/protocol cohort, preferring independence, breadth and then recency, instead of comparing unrelated category winners. Displayed shortlist percentiles can therefore differ from the table's multi-benchmark category means. Tests cover static metadata parsing without execution, malformed CSV rejection, reasoning isolation and shared-cohort shortlist selection. General logic, code and agentic tasks remain transfer proxies, not direct Windows RE validation.
