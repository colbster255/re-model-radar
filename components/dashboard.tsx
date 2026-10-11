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
import type { Dataset } from "@/lib/schema";
import type { RankedModel } from "@/lib/scoring";
import { categories, weights, benchmarks, type Category } from "@/lib/config";
import { retention } from "@/lib/variants";
const labels: Record<Category, string> = {
  cyber: "Cybersecurity",
  coding: "Coding",
  systems: "Low-level / RE",
  agentic: "Agentic execution",
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
] as const;
function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={12} />
    </a>
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
  data: Dataset;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState<(typeof filters)[number]>("All models"),
    [sort, setSort] = useState("overall"),
    [selected, setSelected] = useState<RankedModel | null>(null),
    [view, setView] = useState("leaderboard"),
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
      (filter !== "Hosted" || r.providers.length > 0),
  );
  if (sort !== "overall")
    filtered.sort(
      (a, b) =>
        (b.scores[sort as Category] ?? -1) - (a.scores[sort as Category] ?? -1),
    );
  const verified = rows.filter((r) => r.qualified).length,
    withVariants = rows.filter((r) => r.variant).length,
    errors = data.sources.filter((s) => s.status === "error").length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Radar size={21} />
          </span>
          <span>
            RE Model Radar<small>TECHNICAL INTELLIGENCE</small>
          </span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {[
            { id: "leaderboard", label: "Model leaderboard", icon: ScanLine },
            {
              id: "methodology",
              label: "Ranking methodology",
              icon: SlidersHorizontal,
            },
            { id: "sources", label: "Sources & refresh", icon: Database },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={view === id ? "active" : ""}
            >
              <Icon size={16} />
              {label}
              {id === "leaderboard" && (
                <span className="nav-count">{rows.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="research-scope">
          <span className="workspace-label">RESEARCH PROFILE</span>
          <p>
            <Terminal size={14} /> Windows security
          </p>
          <p>
            <Code2 size={14} /> Native C / C++
          </p>
          <p>
            <GitBranch size={14} /> Reverse engineering
          </p>
          <p>
            <ShieldCheck size={14} /> Vulnerability research
          </p>
        </div>
        <div className="sidebar-bottom">
          <div className="pipeline">
            <i className={errors ? "dot amber" : "dot"} />
            <div>
              Hourly research pipeline
              <small>
                {errors
                  ? `${errors} source(s) unavailable`
                  : "Deterministic · no inference cost"}
              </small>
            </div>
          </div>
          <Out href="https://github.com/colbster255/re-model-radar">
            View source on GitHub
          </Out>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <ChevronRight size={13} />{" "}
            <b>
              {view === "leaderboard"
                ? "Model leaderboard"
                : view === "sources"
                  ? "Sources & refresh"
                  : "Ranking methodology"}
            </b>
          </span>
          <span className="topbar-right">
            <span className="live-pill">
              <i className="dot" />
              Evidence-first
            </span>
            <Out href="https://github.com/colbster255/re-model-radar/actions">
              Update history
            </Out>
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR WORKFLOW. YOUR BENCHMARK.</div>
              <h1>
                {view === "leaderboard"
                  ? "Technical model radar"
                  : view === "sources"
                    ? "An open evidence trail"
                    : "How the ranking works"}
              </h1>
              <p>
                {view === "leaderboard"
                  ? "The models that matter for security research, reverse engineering, and systems development."
                  : view === "sources"
                    ? "Every result has a source. Every refresh leaves a trace."
                    : "Base-model competence first. Modified checkpoints evaluated separately."}
              </p>
            </div>
            <span className="profile-badge">
              <Terminal size={14} /> Windows / x64
            </span>
          </div>
          {view === "leaderboard" ? (
            <>
              <section className="stats-grid" aria-label="Dataset overview">
                <div>
                  <span>
                    MODELS TRACKED <Radar size={14} />
                  </span>
                  <strong>
                    {rows.length}
                    <small>across all discovered families</small>
                  </strong>
                </div>
                <div>
                  <span>
                    QUALIFIED RANKINGS <ShieldCheck size={14} />
                  </span>
                  <strong>
                    {verified}
                    <small>
                      {verified
                        ? "meet the independent evidence gate"
                        : "evidence still incomplete"}
                    </small>
                  </strong>
                </div>
                <div>
                  <span>
                    MATCHED VARIANTS <GitBranch size={14} />
                  </span>
                  <strong>
                    {withVariants}
                    <small>exact declared base lineage</small>
                  </strong>
                </div>
                <div>
                  <span>
                    LAST DATA CHANGE <Activity size={14} />
                  </span>
                  <strong className="timestamp">
                    {date(data.refreshedAt)}
                    <small>ET · hourly checks, changes only</small>
                  </strong>
                </div>
              </section>
              <div className="evidence-notice">
                <Info size={16} />
                <p>
                  <b>
                    {verified
                      ? "Evidence coverage varies."
                      : "No definitive #1 yet."}
                  </b>{" "}
                  Provisional scores are relative to evaluated peers. Windows /
                  RE coverage is unverified; manufacturer claims alone cannot
                  earn a qualified rank.
                </p>
                <button onClick={() => setView("methodology")}>
                  Scoring policy <ArrowUpRight size={13} />
                </button>
              </div>
              <section className="leaderboard">
                <div className="section-heading">
                  <div>
                    <h2>
                      Model leaderboard <span>{filtered.length}</span>
                    </h2>
                    <p>
                      Base models ranked first. Abliterated counterparts linked
                      below.
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
                        <option value="coding">Coding</option>
                        <option value="cyber">Cybersecurity</option>
                        <option value="agentic">Tool reliability proxy</option>
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
                        <th>
                          OVERALL {sort === "overall" && <span>↓</span>}
                        </th>
                        <th>CODING {sort === "coding" && <span>↓</span>}</th>
                        <th>CYBERSECURITY {sort === "cyber" && <span>↓</span>}</th>
                        <th>CONFIDENCE</th>
                        <th>RETENTION</th>
                        <th>HOSTING</th>
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
                            <button
                              className="model-title"
                              onClick={() => setSelected(r)}
                            >
                              {r.name}
                              {r.releaseDate &&
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
                          </td>
                          <td>
                            <Score value={r.overall} accent />
                            <small className="provisional">
                              {r.qualified
                                ? "Qualified"
                                : r.overall !== null
                                  ? "Provisional"
                                  : "Awaiting evidence"}
                            </small>
                          </td>
                          <td>
                            <Score value={r.scores.coding} />
                          </td>
                          <td>
                            <Score value={r.scores.cyber} />
                          </td>
                          <td>
                            <span
                              className={`confidence ${r.qualified ? "medium" : "low"}`}
                            >
                              <i />
                              {r.confidence === "Awaiting evidence"
                                ? "Pending"
                                : r.confidence}
                            </span>
                            <small className="coverage">
                              {r.coverage}% coverage
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
                              {r.variant
                                ? "Comparable tests required"
                                : "No verified comparison"}
                            </small>
                          </td>
                          <td>
                            {r.providers.length ? (
                              <span className="hosted">
                                <i className="dot" />
                                Listed <small>{r.providers[0].name}</small>
                              </span>
                            ) : (
                              <span className="muted">Unverified</span>
                            )}
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
                    {filtered.length} models <i>·</i> Scores are normalized peer
                    percentiles
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
                    <h3>Built for depth, weighted for your work</h3>
                  </div>
                  <div className="weight-bar">
                    {categories.map((c) => (
                      <span
                        key={c}
                        className={`weight-${c}`}
                        style={{ width: weights[c] + "%" }}
                      />
                    ))}
                  </div>
                  <div className="weight-legend">
                    {categories.map((c) => (
                      <span key={c}>
                        <i className={`weight-${c}`} />
                        {labels[c]} <b>{weights[c]}%</b>
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
                  OpenRouter listings, and benchmark repositories are checked
                  without paid inference. Discovery is bounded and cannot
                  guarantee every release. Unavailable adapters retain their
                  prior valid snapshot.
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
function Methodology() {
  return (
    <section className="methodology">
      <div className="method-card">
        <span className="eyebrow">01 / NORMALIZE WITHIN A BENCHMARK</span>
        <h2>Relative evidence, with visible gaps.</h2>
        <p>
          Each benchmark is normalized to a percentile within its source,
          evaluator class, version, harness, effort, and budget cohort. At least
          three distinct models are required. Ties use mid-rank percentiles. A
          percentile of 100 means best in that observed cohort, not perfect
          performance. Scores from different cohorts are imperfect proxies and
          must be read alongside their raw results.
        </p>
        <p>
          For each benchmark, independent results take priority over
          manufacturer reports. Duplicate reports never add weight. Benchmarks
          in the same category have equal weight; category scores are then
          combined using the weights below, renormalized over available
          categories. Missing categories are excluded and reduce coverage,
          rather than becoming zero.
        </p>
        <div className="method-weights">
          {categories.map((c) => (
            <div key={c}>
              <span>{labels[c]}</span>
              <b>{weights[c]}%</b>
            </div>
          ))}
        </div>
      </div>
      <div className="method-card">
        <span className="eyebrow">02 / QUALIFICATION IS SEPARATE</span>
        <h2>Claims cannot buy the top position.</h2>
        <p>
          A qualified rank requires at least 70% weighted coverage, independent
          evaluations in at least two categories, and independent cybersecurity
          evidence. Other models are shown without a numbered rank. Provisional
          models with at least 70% coverage appear first, followed by sparse
          evidence, then sorted by score within those groups. High confidence
          needs 85% coverage; qualified models below that are Medium. Evidence
          older than 365 days is excluded from scoring, but preserved for audit.
        </p>
        <p>
          There is no validated Windows kernel, Vanguard, IDA, Ghidra, WinDbg or
          x64dbg benchmark in the current feeds. Low-level / RE therefore
          remains unscored. Agentic execution is a tool-reliability proxy, not a
          direct measurement of tool-call correctness. Deployment listings and
          context are metadata, not invented performance scores.
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
          verification. Candidates are ordered by independent comparable tests,
          then creator comparable tests, then declared tool support; ties use
          stable identifiers. Without comparable evaluations, the result is a
          candidate, not an endorsed best variant.
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
  data: Dataset;
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
            ? "Qualified ranking"
            : "Provisional / awaiting independent evidence"}
        </p>
        <div className="detail-score">
          <strong>
            {fmt(m.overall)}
            <small>/ 100 peer percentile</small>
          </strong>
          <span>{m.coverage}% evidence coverage</span>
        </div>
        <div className="detail-section">
          <h3>What the evidence supports</h3>
          <p>
            {m.breakdown.length
              ? `Evaluated in ${m.breakdown.length} scored benchmark(s), with ${m.independentCategories} category/categories independently evaluated. Best-supported areas: ${Object.entries(
                  m.scores,
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 2)
                  .map(([c]) => labels[c as Category])
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
                    <dt>Coding / RE retention</dt>
                    <dd>
                      {v.retentions.length
                        ? v.retentions.map((r, i) => (
                            <span key={i}>
                              {r.benchmark}:{" "}
                              {retention(r)?.toFixed(1) ?? "Unverified"}% (
                              {r.kind}){" "}
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
                      {v.providers.length
                        ? v.providers.map((p) => (
                            <Out key={p.url} href={p.url}>
                              {p.name}
                            </Out>
                          ))
                        : "No verified inference provider"}
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
