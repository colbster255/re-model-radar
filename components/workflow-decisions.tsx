"use client";
import { useMemo, useState } from "react";
import type { Dataset, Evidence, Model } from "@/lib/schema";
import {
  baselineId,
  candidateId,
  compare,
  decisionVersion,
  preference,
  roles,
  sensitivity,
  signal,
} from "@/lib/decisions";
import { benchmarks } from "@/lib/config";

type Data = Pick<
  Dataset,
  "evidence" | "variants" | "sources" | "refreshedAt"
> & { evaluatedAt: string };
const number = (n: number | null | undefined) =>
  n == null ? "Unknown" : n.toFixed(2).replace(/\.00$/, "");
const raw = (e: Evidence) =>
  e.metric === "count"
    ? `${e.rawValue} / ${e.denominator} (${number(e.value)}%)`
    : `${number(e.value)}${e.metric === "coverage" ? " coverage" : "%"}`;
function Source({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children} ↗
    </a>
  );
}

export default function WorkflowDecisions({
  models,
  data,
}: {
  models: Model[];
  data: Data;
}) {
  const [roleId, setRoleId] = useState<string>("director");
  const [candidate, setCandidate] = useState(candidateId);
  const [manufacturer, setManufacturer] = useState(true);
  const [published, setPublished] = useState(false);
  const [budget, setBudget] = useState<2 | 6>(6);
  const [securityMultiplier, setSecurityMultiplier] = useState(1);
  const role = roles.find((r) => r.id === roleId)!;
  // Use the server evaluation date to avoid hydration/age differences between browser and build.
  const now = Date.parse(data.evaluatedAt);
  const result = useMemo(
    () =>
      sensitivity(
        data,
        baselineId,
        candidate,
        role,
        { manufacturer, published, budget, securityMultiplier },
        now,
      ),
    [
      data,
      candidate,
      role,
      manufacturer,
      published,
      budget,
      securityMultiplier,
      now,
    ],
  );
  const baseline = models.find((m) => m.id === baselineId)!;
  const other = models.find((m) => m.id === candidate)!;
  const eligibleModels = models
    .filter(
      (m) =>
        m.id !== baselineId && data.evidence.some((e) => e.modelId === m.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const verdict = (p: string) =>
    p === "baseline"
      ? baseline.name
      : p === "candidate"
        ? other.name
        : p === "unknown"
          ? "Insufficient comparable evidence"
          : "Close / mixed evidence";
  const pair = compare(
    data,
    baselineId,
    candidateId,
    { manufacturer: true, published: true, budget },
    now,
  );
  return (
    <div className="workflow">
      <section className="workflow-intro">
        <div>
          <span className="eyebrow">
            DECISION POLICY {decisionVersion} · PROVISIONAL
          </span>
          <h2>Choose for the investigation.</h2>
          <p>
            One Director writes code and coordinates four specialists. GLM-5.3
            is your current baseline for all five agents. These are candidates
            to test, not a migration instruction.
          </p>
        </div>
        <div className="workflow-status">
          <strong>0 direct workflow runs</strong>
          <span>Windows competence · unknown</span>
          <span>MCP reliability · unknown</span>
        </div>
      </section>
      <div className="role-tabs" role="group" aria-label="Workflow role">
        {roles.map((r) => (
          <button
            key={r.id}
            aria-pressed={r.id === roleId}
            className={r.id === roleId ? "active" : ""}
            onClick={() => setRoleId(r.id)}
          >
            {r.name}
          </button>
        ))}
      </div>
      <section className="decision-panel">
        <div className="decision-controls">
          <label>
            Compare against GLM-5.3
            <select
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
            >
              {eligibleModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            ExploitGym budget
            <select
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value) as 2 | 6)}
            >
              <option value={2}>2h · TPS-rescaled</option>
              <option value={6}>6h · TPS-rescaled</option>
            </select>
          </label>
          <label>
            Security emphasis
            <select
              value={securityMultiplier}
              onChange={(e) => setSecurityMultiplier(Number(e.target.value))}
            >
              <option value={0.75}>75% of default</option>
              <option value={1}>Default</option>
              <option value={1.25}>125% of default</option>
            </select>
          </label>
        </div>
        <div className="decision-controls checks">
          <label>
            <input
              type="checkbox"
              checked={manufacturer}
              onChange={(e) => setManufacturer(e.target.checked)}
            />{" "}
            Include manufacturer results
          </label>
          <label>
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />{" "}
            Explore unmatched published peer settings
          </label>
        </div>
        <h2>{role.name}</h2>
        <p className="muted">
          Editorial transfer:{" "}
          {Object.entries(role.weights)
            .map(([key, value]) => `${key} ${Math.round(value * 100)}%`)
            .join(" · ")}
          . These weights express priorities, not measured Windows skill.
        </p>
        <div className="decision-grid">
          <article>
            <span className="eyebrow">RECOMMENDED CANDIDATES TO EVALUATE</span>
            <h3>
              {baseline.name} + {other.name}
            </h3>
            <p>{role.question}</p>
            <p>
              <strong>
                Adjacent evidence leans:{" "}
                {verdict(preference(result.scenarios[0].value))}
              </strong>
            </p>
            <span className="evidence-badge">
              {result.unstable
                ? "Unstable across assumptions"
                : "Consistent in tested assumptions; indirect only"}
            </span>
            <p className="muted">
              {result.groups} eligible publication groups ·{" "}
              {result.pairs.filter((p) => p.eligible).length} paired
              observations · 0 direct Windows tests. Breadth is not performance
              or a confidence probability.
            </p>
          </article>
          <article>
            <span className="eyebrow">WHY THE ANSWER MAY CHANGE</span>
            <p>
              Independent-only uses published benchmark configurations. Adding
              manufacturer security results can change the leaning. Changing
              budgets, weights or removing a publication can change it again.
            </p>
            <p>
              Each publication supplies at most one weighted contribution.
              Missing results remain unknown. A ±1 point evidence balance is
              labeled close/mixed as an editorial rule, not statistical
              equivalence.
            </p>
            <p className="muted">
              Agentic coding is adjacent execution evidence; it does not test
              multi-agent delegation, debugger accuracy or MCP schema
              correctness.
            </p>
          </article>
        </div>
        <details>
          <summary>Sensitivity results and calculation</summary>
          <p>
            Within each publication: role-weighted mean of raw
            percentage-point/coverage-point differences. Across publications:
            weight capped at the publication’s largest role weight. Counts are
            converted using their declared denominator. This evidence balance
            mixes adjacent metrics and is not a competence score; percentile
            ranks never enter it. Unmatched peer settings are excluded unless
            explicitly explored.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Assumption</th>
                  <th>Evidence leaning</th>
                  <th>Editorial balance (points)</th>
                </tr>
              </thead>
              <tbody>
                {result.scenarios.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>{verdict(preference(s.value))}</td>
                    <td>{number(s.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <section className="decision-panel">
        <h2>
          Raw evidence · {baseline.name} vs {other.name}
        </h2>
        <p>
          Positive differences favor GLM. Percentiles describe rank position
          inside the displayed cohort, not capability percentages. Same-table
          results with unresolved peer budgets stay descriptive by default.
        </p>
        <div className="table-scroll">
          <table className="raw-table">
            <thead>
              <tr>
                <th>Benchmark / source</th>
                <th>GLM-5.3</th>
                <th>{other.name}</th>
                <th>Absolute Δ</th>
                <th>
                  Cohort percentile
                  <br />
                  GLM / candidate · n
                </th>
                <th>Use / limitations</th>
              </tr>
            </thead>
            <tbody>
              {result.pairs.map((p) => (
                <tr key={p.a.id}>
                  <td>
                    <Source href={p.a.source}>
                      {benchmarks[p.a.benchmark]?.label ?? p.a.benchmark}
                      {p.a.budgetHours ? ` · ${p.a.budgetHours}h` : ""}
                    </Source>
                    <small>
                      {p.a.kind} · {signal(p.a)}
                      <br />
                      Observed/retrieved {p.a.observedAt.slice(0, 10)}
                    </small>
                  </td>
                  <td>{raw(p.a)}</td>
                  <td>{raw(p.b)}</td>
                  <td>
                    {p.rawDelta > 0 ? "+" : ""}
                    {number(p.rawDelta)}{" "}
                    {p.a.metric === "count"
                      ? "tasks"
                      : p.a.metric === "coverage"
                        ? "coverage points"
                        : "pp"}
                    {Math.abs(p.delta) <= 1 ? (
                      <small>Numerically close; no significance claim</small>
                    ) : null}
                  </td>
                  <td>
                    {number(p.percentileA)} / {number(p.percentileB)} · {p.n}
                  </td>
                  <td>
                    <strong>
                      {p.eligible ? "Adjacent input" : "Descriptive / excluded"}
                    </strong>
                    <small>{p.reason}</small>
                    <details>
                      <summary>Protocol & caveats</summary>
                      <p>{p.a.protocol}</p>
                      <p>{p.a.notes}</p>
                      <p>Candidate: {p.b.notes}</p>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!result.pairs.length ? (
          <p>No current paired cohort. Unknown does not mean weak.</p>
        ) : null}
        <details>
          <summary>Unpaired observations (no head-to-head inference)</summary>
          {data.evidence
            .filter(
              (e) =>
                [baselineId, candidate].includes(e.modelId) &&
                !result.pairs.some((p) => p.a.id === e.id || p.b.id === e.id),
            )
            .map((e) => (
              <p key={e.id}>
                <Source href={e.source}>
                  {e.modelId} · {benchmarks[e.benchmark]?.label ?? e.benchmark}
                </Source>{" "}
                · {raw(e)} · {e.kind} · {e.observedAt.slice(0, 10)}
                <br />
                <small>
                  {e.protocol} · {e.notes}
                </small>
              </p>
            ))}
        </details>
      </section>
      {candidate !== candidateId ? (
        <section className="decision-panel">
          <h2>Kimi K3 vs GLM-5.3 · pinned comparison</h2>
          <p>
            {pair.length} paired published observations remain available. Select
            Kimi K3 above to inspect the complete raw comparison and
            sensitivity.
          </p>
          <button
            className="workflow-button"
            onClick={() => setCandidate(candidateId)}
          >
            Compare Kimi K3
          </button>
        </section>
      ) : null}
      <section className="decision-panel">
        <h2>Cloud inference · local Windows tools</h2>
        <p>
          Featherless is primary; OpenRouter routes are optional premium
          fallbacks. Model weights do not imply laptop GPU feasibility. Plan
          access, successful serving, practical context, latency and cost per
          completed task are unknown until tested.
        </p>
        <div className="decision-grid">
          {[baseline, other].map((m) => (
            <article key={m.id}>
              <h3>{m.name}</h3>
              <code>{m.id}</code>
              <p>
                Architectural maximum:{" "}
                {m.id === candidateId
                  ? "1,048,576 tokens (model card)"
                  : "See model configuration; 1M used in some publisher evaluations"}
                . Practically tested here: none.
              </p>
              {m.providers.map((p) => {
                const health = data.sources.find((s) =>
                  p.name.includes("Featherless")
                    ? s.id === "featherless"
                    : s.id === "openrouter",
                );
                return (
                  <div className="provider-record" key={p.url}>
                    <Source href={p.source}>
                      {p.name} ·{" "}
                      {p.mode ??
                        (p.url.endsWith(":batch") ? "batch" : "mode unknown")}
                    </Source>
                    <code>{p.modelId ?? "Exact API ID not recorded"}</code>
                    <small>
                      Catalog checked{" "}
                      {p.checkedAt?.slice(0, 10) ??
                        health?.lastSuccess?.slice(0, 10) ??
                        "unknown"}{" "}
                      ·{" "}
                      {health?.status === "error"
                        ? "FAILED check; retained listing"
                        : "listing only"}
                    </small>
                    <p>
                      Provider context:{" "}
                      {p.context?.toLocaleString() ?? "unknown"} · output cap:{" "}
                      {p.output?.toLocaleString() ?? "unknown"}
                      <br />
                      Tools:{" "}
                      {p.tools === undefined
                        ? "unknown"
                        : p.tools
                          ? "declared supported"
                          : "not declared"}{" "}
                      · reliability untested
                      <br />
                      Concurrency unit cost: {p.concurrencyUnits ?? "unknown"} ·
                      your plan limit/access unknown
                      <br />
                      USD per 1M tokens: input {number(p.inputPerMillion)},
                      output {number(p.outputPerMillion)}. Subscription coverage
                      depends on plan; these are catalog rates.
                    </p>
                  </div>
                );
              })}
              {!m.providers.length ? (
                <p>No verified exact hosting record.</p>
              ) : null}
              <p>
                <Source href={m.card}>Model card / reasoning controls</Source>
              </p>
              <p>
                {m.id === candidateId
                  ? "Kimi: thinking always enabled; low/high/max effort, default max. Preserve complete assistant reasoning_content and tool_calls history. LibreChat/provider handling untested."
                  : m.id === baselineId
                    ? "GLM: low/high/max effort, default max; card recommends clear_thinking=true for chat. Provider passthrough and LibreChat behavior untested."
                    : "Check provider support for model-specific reasoning controls and history requirements."}
              </p>
            </article>
          ))}
        </div>
        <p>
          <Source href="https://featherless.ai/docs/api-reference-plan">
            Featherless plan limits
          </Source>{" "}
          · effective context is bounded by both provider and subscription. Five
          simultaneous calls at four units each would require 20 available
          units; delegation need not be simultaneous. No assumption about your
          actual plan.
        </p>
      </section>
      <section className="decision-panel">
        <h2>Workflow evaluation · unrun</h2>
        <p>
          Six task views, five agents. A reusable manifest, purpose-built
          Windows fixture, known answers, per-run record validator and offline
          scoring are included. Nothing sends inference requests or attaches
          debuggers.
        </p>
        <div className="decision-grid">
          {roles.map((r) => (
            <article key={r.id}>
              <h3>{r.name}</h3>
              <span className="evidence-badge">UNRUN</span>
              <p>{r.question}</p>
            </article>
          ))}
        </div>
        <p>
          Real MCP schemas must be exported from your installed tool servers and
          hash-pinned before a run can be admitted. Equal fixture, prompt,
          budgets and tool schema hashes are required for comparisons. Refusals
          and technical failures are recorded separately. Qualitative judgments
          require reviewer notes; small samples have no significance claim.
        </p>
        <Source href="https://github.com/colbster255/re-model-radar/blob/main/evals/README.md">
          Evaluation setup and record format
        </Source>
      </section>
      <section className="decision-panel">
        <h2>Versioned audit & uncertainty</h2>
        <p>
          Policy v2 converted benchmark ranks into apparently precise task fits,
          reused related signals, and missed ExploitGym counts. Policy v3 uses
          raw paired observations and a provisional shortlist. Original v2
          snapshots are archived; changed card records carry v3 IDs. No measured
          competence transfers to modified checkpoints.
        </p>
        <p>
          All Windows role conclusions remain editorial. Independent-only
          support is narrow; manufacturer reports and unmatched budgets can
          materially affect the answer. No confidence interval or probability of
          being best is claimed.
        </p>
        <Source href="https://github.com/colbster255/re-model-radar/blob/main/docs/workflow-audit-v3.md">
          Read the audit and methodology
        </Source>
      </section>
    </div>
  );
}
