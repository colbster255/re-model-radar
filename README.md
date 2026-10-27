# RE Model Radar v4

A simple, pink-accented top 10 of open-weight models for reverse-engineering-adjacent work, with source links, exact modified checkpoints and estimated call prices. The app has two tabs: Top 10 and Call pricing. Archived rankings and model comparisons are no longer part of the website.

## Run

Node 24 recommended. `npm ci`, `npm run refresh`, `npm run dev`. Validate with `npm run check`.

## Ranking

`lib/top-ten.ts` ranks the newest public LiveBench 2.0 release: coding 40%, reasoning 35%, long-agentic tasks 25%. These shared tests cover real bug fixing, logic/state reasoning and sustained engineering. The weighted raw-score index is an editorial selection aid, not measured Windows RE accuracy. Each stat also shows its raw score and rank among all eligible open models in that release. The UI shows only ten.

Every entry must be publisher-declared open weight and have all three independent results in the same release. Closed models, missing categories and modified checkpoint identities are excluded. Missing values never become zeros; stat ties share ranks. A model with no shared test results cannot enter the ranking merely because it was released. Cyber results are supporting evidence with their original attribution/protocol; visual document-design scores are not presented as creative RE competence. Neither is silently blended into the common ranking. Results older than 90 days stop producing a ranking.

The live collector reads the official site script as a TypeScript syntax tree to extract literal model metadata; remote JavaScript is never executed. It discovers the newest literal release ID, then reads official CSV/category/notes files. LiveBench 2.0 is never merged with 1.0. Source-contract changes fail visibly and preserve prior valid data.

## Automatic updates and the stale-feed fixes

The old LiveBench GitHub data location now returns 404 after the move to 2.0. That adapter is replaced with live-site release discovery. Variant discovery grew beyond 200 entries, which previously failed the whole Featherless adapter. Hosting checks now prioritize the current leaders' exact declared descendants, then recent variants, up to 200 per run; unchecked entries preserve dated records. Public base-model profiles cover the actual top ten rather than two hard-coded candidates. Hugging Face list requests explicitly request cardData so declared lineage is available, and known hosted variants receive detail lookups. Registry metadata/hosting are discovered before benchmark identity reconciliation so a new publisher checkpoint does not remain a placeholder.

GitHub Actions is scheduled hourly and also refreshes when collector/ranking configuration is pushed. Data-only bot commits do not loop into another refresh. Scheduled jobs can be delayed by GitHub; the UI shows actual successful checks and warns after two hours or when feeds fail. It polls status every minute and refreshes server-rendered results when a new snapshot arrives, preserving client state. There is no promise of immediate coverage of unpublished tests or every newly released model. New releases and checked dates remain distinct in the UI.

`data/top-ten.json` exports v4; `data/radar.json` stores provenance. Older calculation modules/snapshots remain repository audit material, not website views. Adapters remain isolated; all-source failure preserves the exact snapshot. No paid inference or user agent/debugger changes occur.

## Prices

Example calls default to 2,000 input and 1,000 output tokens. Users can choose presets or their own sizes. Formula: input tokens × USD input rate / 1M + output tokens × USD output rate / 1M. Output includes billed reasoning tokens. A tool-driven investigation can involve multiple calls. No cache discounts, tax, payment fees or tool charges are assumed.

The provider recommendation means lowest listed compatible interactive price, not tested reliability. OpenRouter's individual endpoint API supplies actual named provider routes, routing tags, context/output limits, quantization and price pairs. Only active non-flex routes declaring tool support qualify. Catalog-wide minimum input/output rates are not combined into a fictional single provider price. Batch, offline, failed, stale (30+ day), unknown-price and context-incompatible routes are excluded. Featherless public profiles are included; actual subscription coverage remains plan-dependent and may mean no additional token charge. No fixed price per message is claimed.

## Modified weights

Only exact declared base lineage plus listed weight artifacts can establish a modified-checkpoint match. Selection favors comparable retention evidence, then usable hosting, not reduced refusals. Without comparable tests the checkpoint is labeled unvalidated and never inherits the base model's measured scores. Hosting is an exact dated catalog listing, not proof of subscription access or inference success. Discovery is bounded and best means best available match among discovered checkpoints.

## Deployment

Existing Vercel Git integration on `main`, Node 24. No runtime secrets needed. GitHub Actions uses built-in GITHUB_TOKEN and optional HF_TOKEN for gated metadata. No secrets are committed. Source validation, HTTPS allowlists, bounded queries, timeouts, safe links and escaped rendering remain in place.
