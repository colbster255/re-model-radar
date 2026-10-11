"use client";
import { useEffect, useRef, useState } from "react";
import {
  Radar,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  GitBranch,
  Database,
  Activity,
  Info,
  X,
  ArrowUp,
  ArrowDown,
  Check,
  Terminal,
  Code2,
  ScanLine,
} from "lucide-react";
import Link from "next/link";
import WorkflowDecisions from "./workflow-decisions";
import type { Variant, Dataset } from "@/lib/schema";
import type { RankedModel } from "@/lib/scoring";
import { benchmarks, type ScoreCategory } from "@/lib/config";
import {
  capabilities,
  capabilityEvidence,
  capabilityLeaders,
} from "@/lib/capabilities";
import { fitCategories, fitWeights } from "@/lib/fit";
import { retention } from "@/lib/variants";
type DashboardData = Pick<
  Dataset,
  "refreshedAt" | "evidence" | "variants" | "sources"
> & { evaluatedAt: string };
const labels: Record<ScoreCategory, string> = {
  reasoning: "Thinking / reasoning",
  cyber: "Reversing",
  coding: "Coding",
  systems: "Low-level / RE",
  agentic: "Tool use",
  deployment: "Deployment",
};
const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(1));
const date = (s: string) =>
  new Date(s).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Toronto",
  });
const filters = [
  "All models",
  "Open weight",
  "Abliterated available",
  "Hosted",
  "Variant hosted",
] as const;
function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={12} />
    </a>
  );
}
function VariantHosting({
  variant,
  sources,
}: {
  variant?: Variant;
  sources: Dataset["sources"];
}) {
  if (!variant) return <span className="muted">No matched variant</span>;
  const checks = ["Featherless", "OpenRouter"].map((provider) => {
    const check = variant.hostingChecks.find((c) => c.provider === provider);
    const health = sources.find(
      (s) =>
        s.id === (provider === "Featherless" ? "featherless" : "openrouter"),
    );
    const listing = variant.providers.find((p) =>
      p.name.toLowerCase().includes(provider.toLowerCase()),
    );
    const stale = health?.status === "error";
    return (
      <div key={provider} className="variant-hosting-row">
        {listing ? (
          <Out href={listing.url}>{provider}</Out>
        ) : (
          <span>
            {provider}:{" "}
            {check?.status === "inactive"
              ? "Inactive listing"
              : check?.status === "not-found"
                ? "Not listed"
                : "Unverified"}
          </span>
        )}
        <small className="coverage">
          {stale
            ? "Check unavailable; prior result"
            : health?.lastSuccess
              ? "Checked " + date(health.lastSuccess) + " ET"
              : "Not checked"}
        </small>
      </div>
    );
  });
  return (
    <div className="variant-hosting">
      {checks}
      <small className="muted">Exact checkpoint; catalog status</small>
    </div>
  );
}
function Score({
  value,
  accent = false,
}: {
  value: number | undefined | null;
  accent?: boolean;
}) {
  return (
    <div className={`score ${accent ? "accent" : ""}`}>
      <span>{fmt(value)}</span>
      <div className="score-track">
        <i style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}
export default function Dashboard({
  rows,
  data,
}: {
  rows: RankedModel[];
  data: DashboardData;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState<(typeof filters)[number]>("All models"),
    [sort, setSort] = useState("overall"),
    [selected, setSelected] = useState<RankedModel | null>(null),
    [view, setView] = useState("workflow"),
    [limit, setLimit] = useState(15);
  const [lastCheck, setLastCheck] = useState<string | null>(null),
    [conclusion, setConclusion] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const update = () =>
      fetch("/api/status", { signal: controller.signal })
        .then((r) => r.json())
        .then((d) => {
          setLastCheck(d.lastSuccessfulCheck);
          setConclusion(d.latestConclusion);
        })
        .catch(() => {});
    update();
    const id = setInterval(update, 300000);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, []);
  const filtered = rows.filter(
    (r) =>
      `${r.name} ${r.family} ${r.variant?.name ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter !== "Open weight" || r.openWeight) &&
      (filter !== "Abliterated available" || r.variant) &&
      (filter !== "Hosted" || r.providers.length > 0) &&
      (filter !== "Variant hosted" || (r.variant?.providers.length ?? 0) > 0),
  );
  if (sort !== "overall")
    filtered.sort(
      (a, b) =>
        (b.scores[sort as ScoreCategory] ?? -1) -
        (a.scores[sort as ScoreCategory] ?? -1),
    );
  const verified = rows.filter((r) => r.qualified).length,
    withVariants = rows.filter((r) => r.variant).length,
    errors = data.sources.filter((s) => s.status === "error").length;
  const refreshFailed =
    conclusion !== null &&
    !["success", "skipped", "neutral"].includes(conclusion);
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark">
              <Radar size={23} />
            </span>
            <span>RE Model Radar</span>
          </Link>
          <span className="header-divider" />
          <span className="workspace-name">
            <Code2 size={15} /> Research workspace{" "}
            <span className="workspace-tier">PUBLIC</span>
          </span>
          <div className="header-actions">
            <Out href="https://github.com/colbster255/re-model-radar">
              GitHub
            </Out>
            <Out href="https://github.com/colbster255/re-model-radar/actions">
              Update history
            </Out>
            <span
              className="workspace-avatar"
              aria-label="Reverse engineering workspace"
            >
              RE
            </span>
          </div>
        </div>
        <div className="nav-shell">
          <nav aria-label="Main navigation">
            {[
              { id: "workflow", label: "Workflow decisions", icon: ScanLine },
              {
                id: "leaderboard",
                label: "Archived v2 ranking",
                icon: ScanLine,
              },
              {
                id: "methodology",
                label: "Archived v2 methodology",
                icon: SlidersHorizontal,
              },
              { id: "variants", label: "Variant hosting", icon: GitBranch },
              { id: "sources", label: "Sources & refresh", icon: Database },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                aria-current={view === id ? "page" : undefined}
                className={view === id ? "active" : ""}
              >
                <Icon size={16} /> {label}
                {id === "leaderboard" && (
                  <span className="nav-count">{rows.length}</span>
                )}
              </button>
            ))}
          </nav>
          <span className="pipeline-status">
            <i className={errors || refreshFailed ? "dot amber" : "dot"} />
            {refreshFailed
              ? "Latest refresh failed · snapshot retained"
              : errors
                ? errors + " sources unavailable"
                : "Snapshot sources healthy"}
            <span>Hourly sync</span>
          </span>
        </div>
      </header>
      <div className="main-shell">
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">RESEARCH / MODEL INTELLIGENCE</div>
              <h1>
                {view === "workflow"
                  ? "Models for your Windows workflow"
                  : view === "leaderboard"
                    ? "Archived v2 heuristic"
                    : view === "variants"
                      ? "Abliterated model hosting"
                      : view === "sources"
                        ? "Sources & collection"
                        : "Ranking methodology"}
              </h1>
              <p>
                {view === "workflow"
                  ? "Raw evidence, role-specific candidates and practical cloud deployment."
                  : view === "leaderboard"
                    ? "Superseded heuristic: percentile-based scores below are not Windows capability measurements."
                    : view === "variants"
                      ? "Exact checkpoint listings on Featherless and OpenRouter, separate from base-model hosting."
                      : view === "sources"
                        ? "Every result has a source. Every refresh leaves a trace."
                        : "Base-model competence first. Modified checkpoints evaluated separately."}
              </p>
            </div>
            <span className="profile-badge">
              <Terminal size={14} /> Windows / x64
            </span>
          </div>
          {view === "workflow" ? (
            <WorkflowDecisions models={rows} data={data} />
          ) : view === "leaderboard" ? (
            <>
              <div className="decision-panel">
                <strong>Archived policy v2 — superseded.</strong>
                <p>
                  This heuristic is retained for audit only. Use Workflow
                  decisions for current recommendations. Base-model scores below
                  never measure associated variants.
                </p>
              </div>
              <section className="stats-grid" aria-label="Dataset overview">
                <div>
                  <span>
                    MODELS TRACKED <Radar size={14} />
                  </span>
                  <strong>
                    {rows.length}
                    <small>Models in the research catalog</small>
                  </strong>
                </div>
                <div>
                  <span>
                    RANKED ESTIMATES <ShieldCheck size={14} />
                  </span>
                  <strong>
                    {verified}
                    <small>
                      {verified
                        ? "have evidence in at least two skill areas"
                        : "Awaiting broader evidence"}
                    </small>
                  </strong>
                </div>
                <div>
                  <span>
                    MATCHED VARIANTS <GitBranch size={14} />
                  </span>
                  <strong>
                    {withVariants}
                    <small>Exact declared base lineage</small>
                  </strong>
                </div>
                <div>
                  <span>
                    LAST DATA CHANGE <Activity size={14} />
                  </span>
                  <strong className="timestamp">
                    {date(data.refreshedAt)}
                    <small>ET · most recent material update</small>
                  </strong>
                </div>
              </section>
              <div className="evidence-notice">
                <Info size={16} />
                <p>
                  <b>Estimated fit, separate confidence.</b> Scores combine
                  transferable skills for RE. They are reasoned estimates, not
                  measured Windows RE accuracy or probabilities. Missing
                  evidence lowers confidence; it is not a proven weakness.
                </p>
                <button onClick={() => setView("methodology")}>
                  Scoring policy <ArrowUpRight size={13} />
                </button>
              </div>
              <section
                className="capability-section"
                aria-label="RE capability shortlists"
              >
                <div className="capability-heading">
                  <h2>Which models fit each part of RE?</h2>
                  <p>
                    Likely task fit from reasoning, coding, security and tool
                    execution evidence. Overall rewards models that overlap
                    across all four. Select a model to inspect the reasoning.
                  </p>
                </div>
                <div className="capability-grid">
                  {capabilities.map((c) => (
                    <article className="capability-card" key={c.key}>
                      <button
                        className="capability-title"
                        onClick={() => {
                          setSort(c.key);
                          setLimit(15);
                        }}
                        aria-label={`Sort by ${c.title}`}
                      >
                        <h3>{c.title}</h3>
                        <ArrowUpRight size={15} />
                      </button>
                      <p>{c.use}</p>
                      <ol>
                        {capabilityLeaders(filtered, c.key).map((r) => {
                          return (
                            <li key={r.id}>
                              <button onClick={() => setSelected(r)}>
                                <span>
                                  {r.name}
                                  <small>
                                    Estimated RE fit -{" "}
                                    {r.fits[c.key].confidence} confidence
                                  </small>
                                </span>
                                <b>{fmt(r.capabilityScore)}</b>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                      {!capabilityLeaders(filtered, c.key).length && (
                        <p className="capability-empty">
                          Not enough evidence across skill areas for these
                          filters.
                        </p>
                      )}
                      <small className="capability-caveat">{c.caveat}</small>
                    </article>
                  ))}
                </div>
              </section>
              <section className="leaderboard">
                <div className="section-heading">
                  <div>
                    <h2>
                      Model leaderboard <span>{filtered.length}</span>
                    </h2>
                    <p>
                      Overall = balanced overlap across the four RE task
                      estimates.
                    </p>
                  </div>
                  <span className="mini-label">
                    <i className="dot" />
                    Live evidence snapshot
                  </span>
                </div>
                <div className="toolbar">
                  <div className="filter-tabs" aria-label="Model filters">
                    {filters.map((f) => (
                      <button
                        key={f}
                        aria-pressed={filter === f}
                        onClick={() => {
                          setFilter(f);
                          setLimit(15);
                        }}
                        className={filter === f ? "selected" : ""}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="search-sort">
                    <label className="search">
                      <Search size={14} />
                      <input
                        aria-label="Search models"
                        placeholder="Search models…"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setLimit(15);
                        }}
                      />
                    </label>
                    <label className="sort">
                      <SlidersHorizontal size={14} />
                      <select
                        aria-label="Sort models"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="overall">Overall</option>
                        <option value="reasoning">Thinking / reasoning</option>
                        <option value="coding">Coding</option>
                        <option value="cyber">Reversing fit</option>
                        <option value="agentic">Tool use fit</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th className="rank-cell">#</th>
                        <th>BASE MODEL / VARIANT</th>
                        <th>OVERALL {sort === "overall" && <span>↓</span>}</th>
                        <th>
                          REASONING {sort === "reasoning" && <span>↓</span>}
                        </th>
                        <th>CODING {sort === "coding" && <span>↓</span>}</th>
                        <th>
                          REVERSING FIT {sort === "cyber" && <span>↓</span>}
                        </th>
                        <th>
                          TOOL USE FIT {sort === "agentic" && <span>↓</span>}
                        </th>
                        <th>CONFIDENCE</th>
                        <th>RETENTION</th>
                        <th>BASE HOSTING</th>
                        <th>VARIANT HOSTING</th>
                        <th>UPDATED</th>
                        <th>
                          <span className="sr-only">Details</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, limit).map((r) => (
                        <tr key={r.id}>
                          <td className="rank-cell">
                            {r.rank ?? "·"}
                            {r.rank &&
                            r.previousRank &&
                            r.rank !== r.previousRank ? (
                              <span className="movement">
                                {r.previousRank > r.rank ? (
                                  <ArrowUp size={10} />
                                ) : (
                                  <ArrowDown size={10} />
                                )}{" "}
                                {Math.abs(r.previousRank - r.rank)}
                              </span>
                            ) : null}
                          </td>
                          <td className="model-cell">
                            <div className="model-identity">
                              <span className="model-avatar" aria-hidden="true">
                                {r.name.slice(0, 2).toUpperCase()}
                              </span>
                              <div className="model-info">
                                <button
                                  className="model-title"
                                  onClick={() => setSelected(r)}
                                >
                                  {r.name}
                                  {r.releaseDate &&
                                    Date.parse(data.refreshedAt) >=
                                      Date.parse(r.releaseDate) &&
                                    Date.parse(data.refreshedAt) -
                                      Date.parse(r.releaseDate) <
                                      14 * 86400000 && (
                                      <span className="new-tag">NEW</span>
                                    )}
                                </button>
                                <div className="model-meta">
                                  <span>{r.family}</span>
                                  <i />
                                  {r.openWeight
                                    ? "Open weight"
                                    : "API / unverified weights"}
                                </div>
                                <div className="variant-line">
                                  <GitBranch size={11} />
                                  {r.variant ? (
                                    <Out href={r.variant.card}>
                                      {r.variant.name}
                                    </Out>
                                  ) : (
                                    <span>No credible matched checkpoint</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Score value={r.overall} accent />
                            <small className="provisional">
                              {r.qualified
                                ? "Estimated overlap"
                                : r.overall !== null
                                  ? "Provisional"
                                  : "Awaiting evidence"}
                            </small>
                          </td>
                          <td>
                            <Score value={r.scores.reasoning} />
                          </td>
                          <td>
                            <Score value={r.scores.coding} />
                          </td>
                          <td>
                            <Score value={r.scores.cyber} />
                          </td>
                          <td>
                            <Score value={r.scores.agentic} />
                          </td>
                          <td>
                            <span
                              className={`confidence ${r.confidence === "Medium" ? "medium" : "low"}`}
                            >
                              <i />
                              {r.confidence === "Awaiting evidence"
                                ? "Pending"
                                : r.confidence}
                            </span>
                            <small className="coverage">
                              {r.coverage}% evidence support
                            </small>
                          </td>
                          <td>
                            <span className="muted">
                              {r.variant?.retentions.some(
                                (c) => retention(c) !== null,
                              )
                                ? "See benchmark"
                                : "Unverified"}
                            </span>
                            <small className="coverage">
                              {r.variant?.retentions.some(
                                (c) => retention(c) !== null,
                              )
                                ? "Per-benchmark measurements"
                                : r.variant
                                  ? "Comparable tests required"
                                  : "No verified comparison"}
                            </small>
                          </td>
                          <td>
                            {r.providers.length ? (
                              r.providers.map((p) => (
                                <Out key={p.url} href={p.url}>
                                  {p.name.replace(" catalog", "")}
                                </Out>
                              ))
                            ) : (
                              <span className="muted">No verified listing</span>
                            )}
                          </td>
                          <td>
                            <VariantHosting
                              variant={r.variant}
                              sources={data.sources}
                            />
                          </td>
                          <td className="date-cell">
                            {new Date(r.updatedAt).toLocaleDateString("en-CA", {
                              month: "short",
                              day: "numeric",
                              timeZone: "America/Toronto",
                            })}
                          </td>
                          <td>
                            <button
                              className="details-trigger"
                              aria-label={`Details for ${r.name}`}
                              onClick={() => setSelected(r)}
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length === 0 && (
                  <div className="empty-state">
                    <Search size={22} />
                    <h3>No models match</h3>
                    <p>Try another search or filter.</p>
                    <button
                      onClick={() => {
                        setQuery("");
                        setFilter("All models");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                <div className="table-footer">
                  <span>
                    Showing {Math.min(limit, filtered.length)} of{" "}
                    {filtered.length} models <i>·</i> Scores are estimated fit
                    indices
                  </span>
                  {filtered.length > limit && (
                    <button onClick={() => setLimit((l) => l + 15)}>
                      Show 15 more <ChevronRight size={13} />
                    </button>
                  )}
                </div>
              </section>
              <section className="bottom-grid">
                <div className="weights-panel">
                  <div className="panel-title">
                    <SlidersHorizontal size={15} />
                    <h3>Balanced RE overlap</h3>
                  </div>
                  <div className="weight-bar">
                    {fitCategories.map((c) => (
                      <span
                        key={c}
                        className={`weight-${c}`}
                        style={{ width: 25 + "%" }}
                      />
                    ))}
                  </div>
                  <div className="weight-legend">
                    {fitCategories.map((c) => (
                      <span key={c}>
                        <i className={`weight-${c}`} />
                        {labels[c]} <b>25%</b>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="integrity-panel">
                  <ShieldCheck size={20} />
                  <div>
                    <h3>Less refusal ≠ more capability</h3>
                    <p>
                      Retention requires the same benchmark and comparable
                      conditions. Without it, we show Unverified.
                    </p>
                    <button onClick={() => setView("methodology")}>
                      Read the methodology <ArrowUpRight size={12} />
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : view === "variants" ? (
            <VariantCatalog data={data} />
          ) : view === "methodology" ? (
            <Methodology />
          ) : (
            <section className="source-list">
              {data.sources.map((s) => (
                <article key={s.id}>
                  <span className={`source-state ${s.status}`}>
                    <Check size={16} />
                  </span>
                  <div>
                    <h3>
                      <Out href={s.url}>{s.name}</Out>
                    </h3>
                    <p>{s.message}</p>
                    <small>
                      Last successful ingestion:{" "}
                      {s.lastSuccess ? date(s.lastSuccess) + " ET" : "Never"}
                    </small>
                  </div>
                  <span className="confidence low">{s.status}</span>
                </article>
              ))}
              <div className="method-card">
                <h3>Polling & discovery limits</h3>
                <p>
                  Hourly GitHub Actions runs may be queued or delayed. Recent
                  and trending Hugging Face releases, variant searches,
                  OpenRouter and Featherless listings, and benchmark
                  repositories are checked without paid inference. Discovery is
                  bounded and cannot guarantee every release. Unavailable
                  adapters retain their prior valid snapshot.
                </p>
                <p>
                  NIST, SEC-Bench and ExploitBench are research references; no
                  general, validated machine-readable result adapter is claimed
                  for them. ExploitBench data currently comes only from the
                  attributed Z.ai comparison.
                </p>
              </div>
            </section>
          )}
          <footer>
            <span>
              <i className={conclusion === "failure" ? "dot amber" : "dot"} />
              {lastCheck
                ? `Last successful pipeline: ${date(lastCheck)} ET`
                : "Pipeline check status unavailable"}{" "}
              <span className="footer-sep">/</span> Snapshot:{" "}
              {date(data.refreshedAt)} ET
            </span>
            <Out href="https://github.com/colbster255/re-model-radar/actions">
              Hourly checks · inspect workflow
            </Out>
          </footer>
        </main>
      </div>
      {selected && (
        <Details model={selected} data={data} close={() => setSelected(null)} />
      )}
    </div>
  );
}
function VariantCatalog({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("Hosted");
  const [limit, setLimit] = useState(20);
  const matches = data.variants
    .filter((v) => {
      const names = v.providers.map((p) => p.name.toLowerCase());
      return (
        (v.id + " " + v.baseIds.join(" "))
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (provider === "All" ||
          (provider === "Hosted" && names.length > 0) ||
          (provider === "Both" &&
            names.some((n) => n.includes("featherless")) &&
            names.some((n) => n.includes("openrouter"))) ||
          (provider === "None" && names.length === 0) ||
          names.some((n) => n.includes(provider.toLowerCase())))
      );
    })
    .toSorted(
      (a, b) =>
        b.providers.length - a.providers.length || a.id.localeCompare(b.id),
    );
  return (
    <section className="variant-catalog">
      <div className="method-card">
        <h2>Where can I run the modified checkpoint?</h2>
        <p>
          Catalog listings are matched by exact repository ID, not a similar
          name or its base model. A listing does not guarantee inference uptime
          or access on your plan. Unverified base lineage remains visible here
          but cannot establish an RE ranking.
        </p>
        <div className="search-sort">
          <label className="search">
            <Search size={14} />
            <input
              aria-label="Search variants"
              placeholder="Search checkpoints or bases..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(20);
              }}
            />
          </label>
          <label className="sort">
            <select
              aria-label="Variant hosting provider"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setLimit(20);
              }}
            >
              <option value="Hosted">Any verified listing</option>
              <option value="Featherless">Featherless</option>
              <option value="OpenRouter">OpenRouter</option>
              <option value="Both">Both providers</option>
              <option value="None">No verified listing</option>
              <option value="All">All checkpoints</option>
            </select>
          </label>
        </div>
        <p>
          {matches.length} matching checkpoints / {data.variants.length} tracked
        </p>
      </div>
      <div className="variant-catalog-grid">
        {matches.slice(0, limit).map((v) => (
          <article className="method-card" key={v.id}>
            <h3>
              <Out href={v.card}>{v.id}</Out>
            </h3>
            <p>
              {v.lineage === "declared"
                ? "Declared base: " + v.baseIds.join(", ")
                : "Base lineage unverified"}{" "}
              - Retention{" "}
              {v.retentions.length ? "see model comparison" : "unverified"}
            </p>
            <span className="evidence-badge">Experimental / unvalidated</span>
            <p>
              Checkpoint exists:{" "}
              {v.available
                ? "registry artifacts listed"
                : "artifacts unverified"}{" "}
              · access: {v.gated ? "gated" : "registry not gated"}.{" "}
              <Out href={v.card + "/tree/main"}>Inspect weight artifacts</Out>
            </p>
            <p>
              Comparable capability retention:{" "}
              {v.retentions.filter((r) => r.comparable).length || "none"}. Tool
              reliability: untested. Plan access: unknown. Serving: untested. No
              inherited base capability score.
            </p>
            <p>{v.refusalNote || "Refusal/compliance measurements unknown."}</p>
            <VariantHosting variant={v} sources={data.sources} />
          </article>
        ))}
      </div>
      {!matches.length && (
        <div className="empty-state">
          <h3>No matching verified listings</h3>
          <p>
            Try another provider or select All checkpoints to inspect checked
            absences.
          </p>
        </div>
      )}
      {matches.length > limit && (
        <button onClick={() => setLimit((l) => l + 20)}>Show 20 more</button>
      )}
    </section>
  );
}
function Methodology() {
  return (
    <section className="methodology">
      <div className="method-card">
        <span className="eyebrow">01 / ESTIMATE TRANSFERABLE TASK FIT</span>
        <h2>Which model is most likely to help with your RE task?</h2>
        <p>
          These are transparent heuristic estimates, not calibrated
          probabilities or direct RE test results. General reasoning supports
          reconstructing behavior; coding supports decompiled-code comprehension
          and offensive implementation; security supports vulnerability
          hypotheses; execution supports terminal and debugger workflows. No
          model gets a hand-picked bonus from its name or reputation.
        </p>
        <p>
          Raw observations are normalized within matching benchmark, source,
          protocol and evaluator cohorts (at least three models). Independent
          results take precedence over duplicate manufacturer reports. Each
          percentile is shrunk toward 50 by cohort size / (cohort size + 10), so
          a tiny comparison cannot manufacture an extreme score. Signals in each
          skill area are averaged; overlapping tests do not multiply confidence.
        </p>
        {capabilities.map((c) => (
          <p key={c.key}>
            <b>{c.title}:</b>{" "}
            {Object.entries(fitWeights[c.key])
              .map(([key, w]) => labels[key as ScoreCategory] + " " + w + "%")
              .join(" / ")}
          </p>
        ))}
        <p>
          Missing inputs use a neutral 50 assumption and provide no evidence
          support. This avoids treating unknown skill as zero or extrapolating a
          single strong test to every missing skill. C++-specific, assembly and
          Windows evidence is currently absent: general coding transfers, but
          specialization remains uncertain. Weights are editorial judgments,
          versioned in code, not learned or validated coefficients.
        </p>
      </div>
      <div className="method-card">
        <span className="eyebrow">
          02 / OVERLAP AND CONFIDENCE ARE SEPARATE
        </span>
        <h2>Strong across all four, with honest uncertainty.</h2>
        <p>
          Overall is the equally weighted geometric mean of the four task-fit
          estimates. A weaker task lowers overlap more than an arithmetic mean
          would. At least two observed skill areas are required for a numbered
          overall rank or shortlist. Confidence never boosts or demotes fit:
          rankable models are ordered by estimated overlap alone.
        </p>
        <p>
          Evidence support is the task-weighted sum of observed signal
          reliability. Independent evidence starts at 80%; manufacturer-only
          evidence at 45%. Small cohorts reduce reliability by cohort size /
          (cohort size + 10); reliability also declines up to 25% with evidence
          age over a year. Disagreement within an area reduces reliability by
          its score range / 200. Reliability is averaged within each skill area,
          so mixed-quality reports do not inherit the strongest report alone.
          Unknown inputs contribute zero support. Task confidence is Medium at
          55% support, otherwise Low; overall uses average task support. No
          estimate receives High confidence until direct RE validation is
          available. These labels describe support for the heuristic, not a
          statistical confidence interval. Evidence older than 365 days or dated
          in the future is excluded. Sources and raw results remain inspectable.
        </p>
      </div>
      <div className="method-card">
        <span className="eyebrow">
          03 / CHECKPOINTS ARE A SEPARATE DECISION
        </span>
        <h2>Lineage first. Retention only when measured.</h2>
        <p>
          Variants require an exact base_model identifier from registry metadata
          and checkpoint files. Similar names, shared families and smaller
          checkpoints do not qualify. Declared lineage is not forensic
          verification. Candidates prefer independent comparable capability
          tests over creator tests, then the strongest weakest measured ratio
          (capped at parity), distinct test coverage and declared tool support;
          ties use stable identifiers. This selection rule is conservative, not
          an overall capability score. Without comparable evaluations, the
          result is a candidate, not an endorsed best variant.
        </p>
        <code>retention = modified score / original score × 100</code>
        <p>
          Retention is reported per benchmark, never as an invented overall
          capability percentage. Refusal, compliance, coding retention and
          cybersecurity competence remain distinct. Registry metadata is
          untrusted data; the collector never executes model code, templates,
          instructions or downloads weights.
        </p>
      </div>
    </section>
  );
}
function Details({
  model: m,
  data,
  close,
}: {
  model: RankedModel;
  data: DashboardData;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const comparisons = data.variants.filter(
    (v) =>
      v.baseIds.includes(m.id) ||
      (m.id === "zai-org/GLM-5.3" &&
        v.id === "audnai/penclaw-GLM-5.3-abliterated"),
  );
  return (
    <dialog
      ref={dialog}
      className="details-panel"
      aria-label={`Details for ${m.name}`}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="detail-content">
        <div className="detail-top">
          <span className="eyebrow">MODEL INTELLIGENCE</span>
          <button onClick={close} aria-label="Close model details">
            <X size={19} />
          </button>
        </div>
        <h2>{m.name}</h2>
        <p className="muted">
          {m.family} ·{" "}
          {m.qualified
            ? "Estimated RE overlap ranking"
            : "Insufficient evidence breadth for overall ranking"}
        </p>
        <div className="detail-score">
          <strong>
            {fmt(m.overall)}
            <small>/ 100 estimated fit</small>
          </strong>
          <span>
            {m.coverage}% evidence support - {m.confidence} confidence
          </span>
        </div>
        <div className="detail-section">
          <h3>Fit for your RE workflow</h3>
          {capabilities.map((c) => (
            <div className="capability-detail" key={c.key}>
              <strong>
                {c.title}: {fmt(m.scores[c.key])}
                {m.scores[c.key] !== undefined
                  ? " / 100 estimated fit"
                  : " · no scored evidence"}
              </strong>
              <p>
                {c.use} {c.caveat}
              </p>
              <p>
                {m.fits[c.key].confidence} confidence - {m.fits[c.key].support}%
                evidence support
              </p>
              <p>{m.fits[c.key].explanation}</p>
              {capabilityEvidence(m, c.key).map((e) => (
                <Out key={e.id} href={e.source}>
                  {benchmarks[e.benchmark].label} · {e.kind}
                </Out>
              ))}
            </div>
          ))}
        </div>
        <div className="detail-section">
          <h3>What the evidence supports</h3>
          <p>
            {m.breakdown.length
              ? `Evaluated in ${m.breakdown.length} scored benchmark(s), with ${m.independentCategories} category/categories independently evaluated. Best-supported areas: ${Object.entries(
                  m.observedScores,
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 2)
                  .map(([c]) => labels[c as ScoreCategory])
                  .join(", ")}.`
              : "No comparable scored cohort yet. This release enters the catalog automatically and awaits evidence."}
          </p>
          <p className="caveat">
            Weaknesses / gaps: Windows internals, assembly, reverse engineering
            and anti-cheat research are not directly validated. Sparse coverage
            and harness differences limit comparisons.
          </p>
        </div>
        <div className="detail-section">
          <h3>Benchmark breakdown</h3>
          {m.breakdown.length ? (
            m.breakdown.map((e) => (
              <div className="benchmark" key={e.id}>
                <div>
                  <Out href={e.source}>{benchmarks[e.benchmark].label}</Out>
                  <small>
                    {e.kind} ·{" "}
                    {new Date(e.observedAt).toLocaleDateString("en-CA", {
                      timeZone: "UTC",
                    })}
                  </small>
                </div>
                <b>
                  {e.value.toFixed(2)}% <small>raw result</small>
                </b>
                <p>
                  {e.protocol}
                  <br />
                  {e.notes}
                </p>
                <span className="normalized">
                  Normalized percentile: {e.normalized.toFixed(1)}
                </span>
              </div>
            ))
          ) : (
            <p className="muted">No qualifying comparable results.</p>
          )}
        </div>
        <div className="detail-section">
          <h3>Runtime & availability</h3>
          <dl>
            <div>
              <dt>Context</dt>
              <dd>
                {m.context
                  ? m.context.toLocaleString() + " tokens (declared)"
                  : "Unverified"}
              </dd>
            </div>
            <div>
              <dt>Architecture</dt>
              <dd>{m.architecture}</dd>
            </div>
            <div>
              <dt>Tool support</dt>
              <dd>
                {m.toolSupport === "declared"
                  ? "Provider / creator declared; reliability unverified"
                  : "Unverified"}
              </dd>
            </div>
          </dl>
          <div className="detail-links">
            <Out href={m.card}>Model card</Out>
            {m.providers.map((p) => (
              <Out key={p.url} href={p.url}>
                {p.name}
              </Out>
            ))}
          </div>
          <p className="muted">
            Catalog listings are checked hourly; inference uptime is not tested.
          </p>
        </div>
        <div className="detail-section">
          <h3>Abliterated checkpoint comparison</h3>
          {comparisons.length ? (
            comparisons.map((v) => (
              <article className="variant-card" key={v.id}>
                <Out href={v.card}>{v.name}</Out>
                <small>
                  {m.variant?.id === v.id
                    ? "Strongest matched candidate · "
                    : ""}
                  {v.lineage === "declared"
                    ? "Exact declared lineage"
                    : "Lineage unverified"}{" "}
                  · {v.gated ? "Gated" : "Public metadata"} ·{" "}
                  {v.available
                    ? "Checkpoint files listed"
                    : "Weights unverified"}
                </small>
                <dl>
                  <div>
                    <dt>Measured benchmark retention</dt>
                    <dd>
                      {v.retentions.length
                        ? v.retentions.map((r, i) => (
                            <span key={i}>
                              {r.benchmark}:{" "}
                              {retention(r) === null
                                ? "Unverified"
                                : `${retention(r)!.toFixed(1)}%`}{" "}
                              ({r.kind}){" "}
                            </span>
                          ))
                        : "Unverified"}
                    </dd>
                  </div>
                  <div>
                    <dt>Tool calling</dt>
                    <dd>
                      {v.toolSupport === "declared"
                        ? "Creator declared; reliability unverified"
                        : "Unverified"}
                    </dd>
                  </div>
                  <div>
                    <dt>Context / architecture</dt>
                    <dd>
                      {v.context?.toLocaleString() ?? "Unverified"} /{" "}
                      {v.architecture}
                    </dd>
                  </div>
                  <div>
                    <dt>Hosting</dt>
                    <dd>
                      <VariantHosting variant={v} sources={data.sources} />
                    </dd>
                  </div>
                </dl>
                <p>{v.refusalNote}</p>
                {v.caveats.map((c) => (
                  <p className="caveat" key={c}>
                    {c}
                  </p>
                ))}
              </article>
            ))
          ) : (
            <p className="muted">
              No credible same-base abliterated checkpoint found in the current
              discovery window.
            </p>
          )}
        </div>
        <div className="detail-section">
          <h3>All supporting observations</h3>
          {data.evidence
            .filter((e) => e.modelId === m.id)
            .map((e) => (
              <div className="observation" key={e.id}>
                <Out href={e.source}>
                  {benchmarks[e.benchmark]?.label ?? e.benchmark}:{" "}
                  {e.value.toFixed(2)}%
                </Out>
                <small>
                  {e.kind} · {e.protocol}
                </small>
              </div>
            ))}
        </div>
      </div>
    </dialog>
  );
}
