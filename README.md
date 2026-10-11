# RE Model Radar

A focused, automatically refreshed Next.js dashboard for Windows security research, reverse engineering, C/C++ and agentic systems engineering. No accounts, database, paid inference or analytics.

## Run

Node 24 recommended (22+ supported).

```sh
npm ci
npm run refresh
npm run dev
npm run check
```

## Visual theme

The interface adapts the open-source [shadcn/ui dashboard](https://ui.shadcn.com/blocks?category=dashboard) aesthetic: Neutral dark zinc surfaces, restrained borders, rounded cards and emerald accents. A full-width navigation and table layout keeps the research data central. Model identifiers, source cards and the accessible centered details dialog share the same tokens. The implementation uses native React controls and local CSS without a runtime theme service or external font dependency.

## Architecture

The dashboard estimates four RE workflow capabilities: thinking/reasoning, offensive coding, reversing and tool use. Scoring v2 uses explicit transferable-skill weights in lib/fit.ts, not a shared-benchmark winner for each card. Reasoning strongly informs reversing; coding informs both implementation and code comprehension; security and execution provide task-specific support. Every model detail shows the inputs, unknown assumptions, confidence and source results. Scores are heuristic fit indices, not probabilities or direct Windows RE accuracy.

Each benchmark percentile is shrunk toward a neutral 50 using n/(n+10), where n is the unique matching cohort size. Missing skill inputs also stay neutral, with zero evidence support. Four task estimates are combined with an equally weighted geometric mean to reward balanced overlap. At least two observed skill areas are required for overall ranking/shortlists. Confidence is separate from fit and never changes ordering. Independent signals start at 0.8 reliability and manufacturer-only signals at 0.45; cohort breadth, recency and disagreement reduce support. No High confidence is assigned without direct RE validation. All coefficients are editorial judgments, not trained or validated estimates. Rankings from the old scoring version are not compared for movement.


LiveBench is an hourly collector source for reasoning, coding and agentic coding. It discovers the latest public release and uses the benchmark publisher's default model configuration, with a declared variant fallback when that row is absent. Category values use complete subtask means following the publisher's calculation; missing subtasks skip the category. Effort varies between models and is recorded. The table-file publication timestamp is used because per-run dates are unavailable. Remote model metadata is parsed with a static syntax tree and never executed; unknown/malformed CSV contracts fail closed. Exact Hugging Face IDs and reviewed closed-model aliases link results to base entries. Finetune entries are excluded.

- `lib/adapters/`: public source adapters, schemas, provenance and safe HTTP ingestion.
- `lib/config.ts`: benchmark definitions and legacy evidence-summary settings.
- `lib/scoring.ts`: cohort normalization and v2 fit ranking; lib/fit.ts defines task-transfer weights and evidence support.
- `lib/matching.ts` / `lib/variants.ts`: exact checkpoint matching and comparable benchmark retention.
- `scripts/refresh.ts`: incremental last-known-good merge and atomic material-change snapshots.
- `data/radar.json` / `data/rankings.json`: versioned source observations and calculated output.
- `components/dashboard.tsx`: search, filters, sorting, methodology, sources and accessible native-dialog details.
- `.github/workflows/refresh.yml`: hourly checks at minute 17, plus manual dispatch. Only changed data is committed.

## Sources and limitations

Validated public feeds: CyberGym and ExploitGym JSON, official Terminal-Bench 4.0 submissions, SWE-bench Multilingual JSON, Hugging Face registry metadata and OpenRouter's public model catalog. Z.ai's GLM-5.3 evaluation table supplies explicitly manufacturer-attributed comparison results. Model-card Markdown is parsed as data with strict numeric/table validation, never executed.

Leaderboard hosting does not imply independent evaluation. CyberGym agent-only and multi-model results are excluded. Terminal-Bench submissions identify the agent vendor rather than the evaluator; independence is unverified, so they are preserved for audit and excluded from scoring. SWE-bench uses checked benchmark-team mini-SWE-agent runs only. Independent evidence takes precedence per benchmark. Harness, version, effort, budget and source distinguish cohorts. Three distinct peers are required for percentile normalization.

The dashboard and exported rankings use scoring v2 described above. The scoreModel helper retains the original benchmark evidence summary for audit compatibility; rankModels applies the v2 fit estimates and ordering. Older than 365-day and future-dated observations are excluded. Manufacturer-only evidence can support a ranked estimate, but receives lower confidence rather than being represented as independently validated.

There is no direct, validated Windows kernel/anti-cheat/assembly/IDA/WinDbg benchmark in these feeds. Direct systems and deployment performance remain unscored; task fit is inferred from adjacent evidence. CyberGym/ExploitGym mostly measure Linux tasks. Coding and agentic results are proxies; do not interpret them as proof of Windows competence or tool-call correctness. Percentiles depend on cohort composition and are not universal accuracy percentages.

Discovery is publisher-agnostic but bounded: recent/trending text models, registry searches for variants, exact base names for relevant open models, hosting catalogs and official benchmark submissions. It is not exhaustive. New checkpoints automatically appear as awaiting evidence. New benchmark names require a reviewed normalization adapter/config entry before scoring. Official model cards and releases are discovered through registry/catalog updates and benchmark metadata, rather than fragile broad web scraping.

Checkpoint lineage is exact `base_model` metadata, **declared rather than forensically verified**. Filename checks confirm weight artifacts are listed, not that the full checkpoint is downloadable or valid. Gated cards are labeled. The selected variant is the strongest matched candidate under available evidence, not an endorsement when capability is unverified. No overall retention percentage is fabricated. MMLU or HarmBench compliance is not coding/RE retention. Audnai's requested checkpoint currently lacks exact structured base lineage and cannot be selected automatically. Requested Kimi variant's public registry declares lineage, but its raw model card is restricted.

NIST, SEC-Bench and other evaluations are useful research references; they are not advertised as automated feeds until a stable and validated data contract is available. ExploitBench currently enters only through the manufacturer table. No claim of comprehensive source coverage is made.

## Automation and deployment

Connect this public repository to a Vercel Next.js project with production branch `main` and Node 24. No runtime secrets are required. GitHub Actions uses its built-in `GITHUB_TOKEN` for rate limits and commits. Optional `HF_TOKEN` belongs only in GitHub Actions secrets if gated metadata access is desired. Never commit credentials. Vercel Git integration must be authorized separately via the account's GitHub Login Connection and repository permissions.

GitHub Actions bot pushes can trigger Vercel's Git integration even though they do not trigger another Actions workflow. Verify the initial manual refresh and its resulting Vercel deployment after connecting. Scheduled runs can be delayed; public inactive repositories may have scheduled workflows disabled after 60 days. Monitor the workflow history. The dashboard requests public workflow status separately from the last material snapshot timestamp, so no-change polls do not force commits or redeploys.

Adapters fail independently and keep their previous valid evidence. Each adapter batch is validated before merging; malformed batches cannot contaminate healthy source updates. Temporary source errors change source health but never erase prior results. Hourly diagnostic JSON is uploaded as a short-lived Actions artifact and excluded from Git. If every source fails, the workflow fails explicitly and leaves versioned snapshots untouched. A successful partial run still displays per-source errors. `refreshedAt` means last material data change, not last attempted poll. Evidence expiration also counts as a material ranking change; the dashboard additionally revalidates hourly on requests.

Variant selection prefers independent comparable capability tests, then creator tests. Within that evidence tier it favors the strongest weakest measured ratio (capped at parity), then distinct benchmark/protocol coverage, then declared tool support and stable IDs. The weakest ratio is a conservative selection tie-break, not an overall retention percentage. Ingestion only accepts recognized capability categories and higher-is-better accuracy/success metrics with matching explicit conditions. Loss, perplexity, refusal and compliance measurements are excluded. Registry updates require exact repository IDs; ambiguous display-name matches and fallback/multi-model benchmark results cannot establish a base-model score.

External metadata is untrusted: schema validation, HTTPS source-host allowlist, timeouts, bounded results, limited retries, React escaping, safe outbound links, no model code execution and no weight downloads.

## Exact variant hosting

The dashboard separates base hosting from modified-checkpoint hosting. OpenRouter is matched only by its exact model ID or declared hugging_face_id; base names never establish variant availability. Featherless's public catalog search is queried by exact repository ID (up to 200 variants, concurrency five), using the public frontend catalog endpoint because the documented /v1/models endpoint currently returns Gone. Only an exact active entry counts as listed. Missing and inactive listings are explicit. Each provider refresh replaces its own listings, preserving the other provider. Source errors preserve last-known-good data and display the unavailable-check warning. Listing is not an inference uptime check or a guarantee of plan access.
