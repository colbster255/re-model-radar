# RE Model Radar audit — policy 3.0.0

Audit date: 2026-10-11. Baseline: GLM-5.3 across one Director and four specialists. Kimi K3 is a candidate. No agents were migrated, paid inference run, debugger attached or real target changed.

## Previous distortions

Policy v2 transformed within-cohort percentile positions into four numeric task-fit estimates, shrank them toward 50, reused correlated reasoning/coding/execution inputs, then combined them into an overall overlap rank. A percentile-point gap could dwarf a small raw-result gap. Missing categories contributed a neutral signal rather than remaining entirely unknown. Manufacturer performance entered the fit despite lowering only the confidence label. The GLM card parser accepted only scalar percentages and six rows, dropping count-form ExploitGym and several execution/coding results. An OpenRouter batch entry could overwrite an interactive listing. Base fit alongside a modified checkpoint could suggest measured variant competence.

Original snapshots: `data/archive/radar-v2-2026-10-11.json` and `data/archive/rankings-v2-2026-10-11.json`, from commit `23c548b6b2cc4ecf9b76a9512aeab5d091ffe7fe`. They are unchanged audit artifacts. Existing modules are explicitly archived in the UI; they are not current workflow recommendations. New card observations carry `glm-card:v3` IDs. Other source observations retain attribution and protocols; metadata additions do not reclassify vendor runs as independent.

## Current decision policy

Six views represent five agents; direct C/C++ implementation is a Director task. There are no measured Windows scores and no authoritative overall winner. Capability, evidence support, cost and hosting are separate. Pair only exact benchmark/protocol/source/attribution/budget/metric cohorts, using the latest observation per model and excluding stale/future evidence. Sharing a table does not establish matched resources. Descriptive rows remain visible even when excluded from the decision. Missing/unpaired data is unknown.

Raw differences drive an explicitly editorial evidence balance, never percentile differences. Within each publication, role-weighted mean differences are aggregated; each publication's cross-source weight is capped at its highest task weight. The three LiveBench category means are one publication, not three independent confirmations. Mirrored results without a common paired protocol do not become extra head-to-head observations. Percentiles need three unique peers and are shown only as rank-position context. ±1 point means numerically close/mixed by editorial convention, not statistical equivalence. No confidence interval is invented.

Sensitivity exposes independent-only versus manufacturer inclusion, ±25% role weights, 2h/6h ExploitGym and removal of each eligible publication. A changed qualitative leaning, including becoming unknown, is labeled unstable. The optional unmatched-peer exploration is clearly separate from the default admissible inputs. Different benchmarks/metric definitions cannot establish an absolute capability scale, even when the editorial balance has a numeric value.

## GLM versus Kimi source check

The [GLM card](https://huggingface.co/zai-org/GLM-5.3) reports mixed results: Terminal 2.1 differs by 0.1 point and DeepSWE by 0.6, favoring Kimi. GLM leads Terminal 3.0, CyberGym, ExploitBench and PostTrainBench; Kimi leads SWE-Marathon and Toolathlon. NL2Repo is tied. All relevant scalar coding/security/execution/tool rows are now ingested, including ProgramBench, AutomationBench, ALE and HLE with tools. FrontierSWE has no Kimi result. GDPval is a rating, excluded from percentage aggregation.

ExploitGym is now two count observations: 2h GLM 105/869 versus Kimi 36/869; 6h 130/869 versus 70/869. Both are manufacturer-reported single-run results using Claude Code 2.1.207/max effort/128000 maximum output. Budgets rescale API inference time using 115 versus 40 TPS plus non-API overhead; they are not measured Featherless latency. ExploitBench is coverage across revisions, not task-success percentage. Card peer harness/resource equality is otherwise unresolved by default; source footnotes remain linked. CyberGym uses unlimited timeout; long execution settings and modified anti-cheat checks limit transfer.

LiveBench independently favors Kimi on published reasoning, coding and agentic-coding means; model effort differs, so this is a published-configuration comparison rather than equal-compute testing. Publication date is not run date. The [Kimi card](https://huggingface.co/moonshotai/Kimi-K3) uses different comparisons including GLM-5.2, not a matched GLM-5.3 workflow. Those numbers are not spliced into a new head-to-head. Kimi requires thinking/tool-call history preservation; GLM documents a different chat-template control. Neither card establishes correctness in LibreChat with these MCP servers.

## Deployment and modified checkpoints

Exact GLM/Kimi Featherless public detail records now include provider context, concurrency-unit cost and token rates. Both advertise 262144-token provider context, separate from architectural context; output cap and practically tested context are unknown. Actual plan access, simultaneous capacity, successful serving and latency remain untested. See [Featherless plan documentation](https://featherless.ai/docs/api-reference-plan). OpenRouter interactive/batch IDs are retained separately; negative dynamic-price sentinels mean unknown, not negative prices. Failed catalog checks preserve dated last-known data and display failure status. Cloud inference does not require these model weights to fit the user's laptop.

Modified checkpoints remain experimental/unvalidated unless comparable retention exists; base capability is never substituted. Registry artifacts/access, declared lineage, exact provider listing, plan access, serving, tool reliability and refusal/compliance are distinct. Lower refusal does not establish higher technical capability.

## What still needs real testing

All six workflow tasks are unrun. `evals/` supplies bounded tasks, purpose-built sources, known answers and offline run admission/reporting, with actual MCP schema exports required before use. No synthetic schema is claimed to be a real debugger API. Logs, objective outputs and qualitative reviewer judgments remain distinct. The bundled WinDbg user dump task does not validate kernel expertise; a pinned known kernel dump/verifier is a required follow-up. No provider, best model or precise Windows probability is inferred from absent tests.
