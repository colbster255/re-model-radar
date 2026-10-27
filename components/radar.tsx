"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Sparkles,
  Radar as RadarIcon,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import type { Source } from "@/lib/schema";
import { cheapest, isFresh, stats, type TopModel } from "@/lib/top-ten";
type Props = {
  rows: TopModel[];
  eligible: number;
  release: string | null;
  snapshotAt: string;
  evaluatedAt: string;
  sources: Source[];
};
const rate = (n: number | null | undefined) =>
  n == null
    ? "unknown"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(n);
const money = (n: number) =>
  n === 0
    ? "$0"
    : n < 0.000001
      ? "<$0.000001"
      : "$" +
        n
          .toFixed(n < 0.001 ? 6 : 4)
          .replace(/0+$/, "")
          .replace(/\.$/, "");
function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={12} />
    </a>
  );
}
const when = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString("en-CA", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Toronto",
      }) + " ET"
    : "Unavailable";
export default function Radar({
  rows,
  eligible,
  release,
  snapshotAt,
  evaluatedAt,
  sources,
}: Props) {
  const router = useRouter();
  const [statusError, setStatusError] = useState(false);
  const [tab, setTab] = useState("rankings"),
    [expanded, setExpanded] = useState<string | null>(null);
  const [input, setInput] = useState(2000),
    [output, setOutput] = useState(1000);
  const [health, setHealth] = useState<{
    serverTime?: string;
    lastSuccessfulCheck: string | null;
    latestConclusion: string | null;
  } | null>(null);
  useEffect(() => {
    const c = new AbortController();
    const check = () =>
      fetch("/api/status", { signal: c.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          setHealth(d);
          setStatusError(false);
          if (d.snapshotAt && d.snapshotAt !== snapshotAt) router.refresh();
        })
        .catch(() => {
          if (!c.signal.aborted) setStatusError(true);
        });
    check();
    const timer = setInterval(check, 60000);
    return () => {
      c.abort();
      clearInterval(timer);
    };
  }, [router, snapshotAt]);
  const now = Date.parse(health?.serverTime ?? evaluatedAt),
    winner = rows[0],
    host = winner ? cheapest(winner, input, output, now) : undefined;
  const late =
    !health?.lastSuccessfulCheck ||
    now - Date.parse(health.lastSuccessfulCheck) > 7200000;
  const failed = Boolean(
    health?.latestConclusion &&
    !["success", "skipped", "neutral"].includes(health.latestConclusion),
  );
  return (
    <div className="radar-app">
      <header className="site-header">
        <Link className="wordmark" href="/">
          <span className="logo">
            <RadarIcon size={23} />
          </span>
          RE Model <b>Radar</b>
        </Link>
        <a
          className="sync-chip"
          href="https://github.com/colbster255/re-model-radar/actions/workflows/refresh.yml"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span
            className={
              late || failed || sources.some((s) => s.status === "error")
                ? "status-dot warning"
                : "status-dot"
            }
          />
          {statusError
            ? "Update status unavailable"
            : !health
              ? "Checking update status"
              : failed
                ? "Latest refresh failed"
                : late
                  ? "Check overdue"
                  : sources.some((s) => s.status === "error")
                    ? "Some feeds unavailable"
                    : "Checked " + when(health.lastSuccessfulCheck)}
          <RefreshCw size={12} />
        </a>
      </header>
      <main>
        <section className="hero">
          <div>
            <div className="kicker">
              <span /> OPEN WEIGHTS. REAL TESTS.
            </div>
            <h1>
              Less noise.
              <br />
              <span>Better RE models.</span>
            </h1>
            <p>
              The ten strongest open-weight models on the latest shared tests.
              Coding, reasoning and getting difficult work done—all in one
              place.
            </p>
            <div className="hero-meta">
              <span>TOP 10 ONLY</span>
              <i />
              <span>NEW DATA CHECKED HOURLY</span>
            </div>
          </div>
          <aside className="winner-card">
            <div className="winner-top">
              <span>
                <Sparkles size={14} /> CURRENT #1
              </span>
              <span>OPEN WEIGHT</span>
            </div>
            <h2>{winner?.name ?? "Awaiting fresh results"}</h2>
            <p>
              {winner
                ? "Highest weighted score in the current tested cohort."
                : "No complete, recent shared test cohort is available."}
            </p>
            {winner ? (
              <>
                <div className="winner-number">
                  {winner.score.toFixed(1)}
                  <span>/ 100 index</span>
                </div>
                <div className="winner-bottom">
                  {host ? (
                    <>
                      <span>
                        From <b>{money(host.cost)}</b> / example call
                      </span>
                      <button
                        onClick={() => setTab("pricing")}
                        aria-label="See pricing"
                      >
                        <ArrowRight size={17} />
                      </button>
                    </>
                  ) : (
                    <span>No fresh price confirmed</span>
                  )}
                </div>
              </>
            ) : null}
          </aside>
        </section>
        <div className="section-bar">
          <nav aria-label="Dashboard tabs">
            <button
              className={tab === "rankings" ? "active" : ""}
              aria-pressed={tab === "rankings"}
              onClick={() => setTab("rankings")}
            >
              Top 10 <span>{rows.length}</span>
            </button>
            <button
              className={tab === "pricing" ? "active" : ""}
              aria-pressed={tab === "pricing"}
              onClick={() => setTab("pricing")}
            >
              Call pricing
            </button>
          </nav>
          <span className="release-label">
            LiveBench 2.0 ·{" "}
            {release
              ? `${release.slice(0, 4)}-${release.slice(4, 6)}-${release.slice(6, 8)}`
              : "No current release"}
          </span>
        </div>
        {tab === "rankings" ? (
          <section aria-label="Top ten rankings">
            <div className="ranking-explainer">
              <strong>One simple ranking.</strong> Coding 40% · reasoning 35% ·
              long tasks 25%. Raw scores, not capability percentiles.{" "}
              <a href="#how-it-works">How it works ↗</a>
            </div>
            <div className="rank-list">
              <div className="rank-grid column-head" aria-hidden="true">
                <span>#</span>
                <span>MODEL / MODIFIED WEIGHTS</span>
                {stats.map((s) => (
                  <span key={s.id}>{s.name.toUpperCase()}</span>
                ))}
                <span>RE INDEX</span>
                <span>LOWEST LISTED CALL*</span>
                <span />
              </div>
              {rows.map((m) => {
                const provider = cheapest(m, input, output, now);
                return (
                  <article
                    className={
                      m.rank === 1 ? "rank-entry first-place" : "rank-entry"
                    }
                    key={m.id}
                  >
                    <div className="rank-grid">
                      <span className="position">
                        {String(m.rank).padStart(2, "0")}
                      </span>
                      <div className="model-cell">
                        <h3>
                          <Out href={m.card}>{m.name}</Out>
                        </h3>
                        <span className="model-family">{m.family}</span>
                        <div className="variant-line">
                          {m.variant ? (
                            <>
                              <Out href={m.variant.card}>{m.variant.name}</Out>
                              <span className="small-tag">
                                {m.variant.retentions.some((r) => r.comparable)
                                  ? "Retention reported"
                                  : "Unvalidated"}
                              </span>
                              {m.variant.providers
                                .filter(
                                  (p) =>
                                    p.mode === "interactive" &&
                                    isFresh(p.checkedAt, now),
                                )
                                .map((p) => (
                                  <Out key={p.url} href={p.url}>
                                    {p.name.replace(" catalog", "")}
                                  </Out>
                                ))}
                            </>
                          ) : (
                            <span>No verified abliterated match</span>
                          )}
                        </div>
                      </div>
                      {m.stats.map((s) => (
                        <div
                          key={s.id}
                          className="stat-cell"
                          role="group"
                          aria-label={`${s.name}: ${s.raw.toFixed(1)}, rank ${s.rank}`}
                        >
                          <span className="mobile-label">{s.name}</span>
                          <strong>{s.raw.toFixed(1)}</strong>
                          <small>#{s.rank}</small>
                        </div>
                      ))}
                      <div className="index-cell">
                        <span className="mobile-label">RE index</span>
                        <strong>{m.score.toFixed(1)}</strong>
                        <div className="score-track">
                          <i style={{ width: `${m.score}%` }} />
                        </div>
                      </div>
                      <div className="host-cell">
                        {provider ? (
                          <>
                            <strong>{money(provider.cost)}</strong>
                            <Out href={provider.url}>{provider.name}</Out>
                          </>
                        ) : (
                          <span>Price unavailable</span>
                        )}
                      </div>
                      <button
                        className="expand-button"
                        aria-label={`Test details for ${m.name}`}
                        aria-expanded={expanded === m.id}
                        onClick={() =>
                          setExpanded(expanded === m.id ? null : m.id)
                        }
                      >
                        <ChevronDown size={17} />
                      </button>
                    </div>
                    {expanded === m.id ? (
                      <div className="evidence-detail">
                        <div>
                          <h4>Actual test results</h4>
                          {m.stats.map((s) => (
                            <p key={s.id}>
                              <Out href={s.source}>
                                {s.name}: {s.raw.toFixed(1)} / 100 · #{s.rank}{" "}
                                of {eligible} open models
                              </Out>
                            </p>
                          ))}
                          <p>
                            Same release and suites. Published effort
                            configurations; no direct Windows RE accuracy claim.
                          </p>
                        </div>
                        <div>
                          <h4>Cyber & creative evidence</h4>
                          <p>
                            {m.cyber ? (
                              <>
                                <Out href={m.cyber.source}>
                                  {m.cyber.benchmark}:{" "}
                                  {m.cyber.value.toFixed(1)}%
                                </Out>{" "}
                                · {m.cyber.kind} report,{" "}
                                {m.cyber.observedAt.slice(0, 10)}. Different
                                protocol; excluded from the common score.
                              </>
                            ) : (
                              "Cybersecurity: no matching current result ingested. Unknown, not a failure."
                            )}
                          </p>
                          <p>
                            {m.design ? (
                              <>
                                <Out href={m.design.source}>
                                  Document design: {m.design.value.toFixed(1)} /
                                  100
                                </Out>
                                . Visual/structural output, not creative reverse
                                engineering; excluded from RE index.
                              </>
                            ) : (
                              "Creative RE problem-solving: not directly tested."
                            )}
                          </p>
                          <p>
                            {m.variant
                              ? "Modified weights are selected by exact lineage, comparable retention first, then listed hosting. The base model’s ranks do not measure the modified checkpoint."
                              : "Abliterated links require exact declared lineage and listed weight artifacts. No name-only hosting guesses."}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {!rows.length ? (
                <div className="empty">
                  No fresh complete cohort. Source failures are listed below.
                </div>
              ) : null}
            </div>
            <p className="table-footnote">
              Stat ranks are among {eligible} tested open models. *Example call:{" "}
              {input.toLocaleString()} input + {output.toLocaleString()} output
              tokens.{" "}
              <button onClick={() => setTab("pricing")}>
                Change call size →
              </button>
            </p>
          </section>
        ) : (
          <section aria-label="Call pricing" className="pricing-section">
            <div className="pricing-heading">
              <div className="kicker">KNOW WHAT A CALL COSTS</div>
              <h2>Small prices. Clear assumptions.</h2>
              <p>
                A call costs the tokens you send plus the tokens the model
                generates. USD estimates—not a flat fee per message.
              </p>
            </div>
            <div className="call-presets">
              {[
                { name: "Small question", i: 500, o: 500 },
                { name: "Typical RE question", i: 2000, o: 1000 },
                { name: "Large code dump", i: 16000, o: 4000 },
              ].map((p) => (
                <button
                  key={p.name}
                  className={input === p.i && output === p.o ? "selected" : ""}
                  onClick={() => {
                    setInput(p.i);
                    setOutput(p.o);
                  }}
                >
                  {p.name}
                  <small>
                    {p.i.toLocaleString()} in · {p.o.toLocaleString()} out
                  </small>
                </button>
              ))}
            </div>
            <div className="token-controls">
              <label>
                Input tokens
                <input
                  type="number"
                  min={0}
                  max={2000000}
                  step={500}
                  value={input}
                  onChange={(e) =>
                    setInput(
                      Math.max(0, Math.min(2000000, Number(e.target.value))),
                    )
                  }
                />
              </label>
              <span>+</span>
              <label>
                Output tokens
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  step={500}
                  value={output}
                  onChange={(e) =>
                    setOutput(
                      Math.max(0, Math.min(1000000, Number(e.target.value))),
                    )
                  }
                />
              </label>
              <p>
                Output includes billed thinking tokens. Tool loops make multiple
                calls; a conversation can cost more.
              </p>
            </div>
            <div className="price-list">
              {rows.map((m) => {
                const p = cheapest(m, input, output, now);
                return (
                  <article key={m.id}>
                    <div>
                      <span className="position">
                        {String(m.rank).padStart(2, "0")}
                      </span>
                      <h3>{m.name}</h3>
                    </div>
                    <div>
                      {p ? (
                        <>
                          <Out href={p.url}>{p.name}</Out>
                          <small>
                            Checked {when(p.checkedAt)}
                            {p.quantization ? ` · ${p.quantization}` : ""}
                          </small>
                        </>
                      ) : (
                        <span>No fresh, compatible price</span>
                      )}
                    </div>
                    <div className="price-total">
                      {p ? (
                        <>
                          <strong>{money(p.cost)}</strong>
                          <small>/ example call</small>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                    <details>
                      <summary>Price breakdown</summary>
                      {p ? (
                        <>
                          <p>
                            {input.toLocaleString()} × $
                            {rate(p.inputPerMillion)}/1M input +{" "}
                            {output.toLocaleString()} × $
                            {rate(p.outputPerMillion)}/1M output ={" "}
                            {money(p.cost)}.
                          </p>
                          <p>
                            <Out href={p.source}>Official price source</Out> ·
                            API model <code>{p.modelId}</code>
                            {p.routingTag ? (
                              <>
                                {" "}
                                · pin provider <code>{p.routingTag}</code> via
                                OpenRouter
                              </>
                            ) : null}
                          </p>
                        </>
                      ) : (
                        <p>
                          Batch listings, failed checks, old prices, unknown
                          rates and endpoints too small for this call are
                          excluded.
                        </p>
                      )}
                    </details>
                  </article>
                );
              })}
            </div>
            <div className="pricing-note">
              <strong>
                Best provider = lowest listed price for this call size.
              </strong>{" "}
              Fresh, compatible interactive routes only; reliability is
              untested. No cache discounts, tax, payment fees or tool charges
              assumed. Featherless subscription coverage depends on your plan—an
              included call may add no token charge.{" "}
              <Out href="https://featherless.ai/docs/api-reference-plan">
                Check your plan
              </Out>
            </div>
          </section>
        )}
        <section id="how-it-works" className="how-section">
          <div>
            <span className="kicker">THE SHORT VERSION</span>
            <h2>
              Built for signal,
              <br />
              not leaderboard noise.
            </h2>
          </div>
          <div className="how-copy">
            <p>
              RE needs code comprehension, careful reasoning and the ability to
              follow a long investigation. Those are well covered by these
              tests. We don’t invent a creativity or cybersecurity score where
              comparable evidence is missing.
            </p>
            <details>
              <summary>Ranking & variant selection</summary>
              <p>
                The RE index is a 40/35/25 weighted mean of raw LiveBench 2.0
                coding, reasoning and long-agentic scores from the newest
                release. Weights are editorial. Every model must be
                publisher-declared open weight and have all three scores. Stat
                ties share ranks. Missing scores and closed models are excluded,
                not scored zero. Releases older than 90 days stop producing
                rankings.
              </p>
              <p>
                New model discovery and testing are separate: new weights reach
                the top 10 after receiving the common tests. Cyber results with
                different protocols remain supporting evidence. Visual design is
                not a substitute for creative RE.
              </p>
              <p>
                Variant links are the best available match in the discovered
                catalog, not proof of competence. Lower refusal doesn’t
                establish better technical ability. An exact hosting listing is
                not proof of plan access or serving.
              </p>
            </details>
            <details>
              <summary>Updates & source health</summary>
              <p>
                Scheduled hourly. GitHub may delay runs; “check overdue” appears
                after two hours without success. New test releases, models,
                variants and prices are collected automatically. Unpublished
                tests cannot be covered.
              </p>
              <p>
                Last successful workflow: {when(health?.lastSuccessfulCheck)}.
                Last material snapshot: {when(snapshotAt)}.
              </p>
              {sources.map((s) => (
                <p key={s.id}>
                  <Out href={s.url}>{s.name}</Out> — {s.status}. Last good
                  check: {when(s.lastSuccess)}. {s.message}
                </p>
              ))}
            </details>
          </div>
        </section>
        <footer>
          <Link className="footer-brand" href="/">
            RE Model Radar <span>v4</span>
          </Link>
          <span>Open weights. Source-linked results. No paid inference.</span>
          <Out href="https://github.com/colbster255/re-model-radar">
            Source code
          </Out>
        </footer>
      </main>
    </div>
  );
}
