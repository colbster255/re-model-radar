import snapshot from "@/data/radar.json";
export async function GET() {
  try {
    const r = await fetch(
      "https://api.github.com/repos/colbster255/re-model-radar/actions/workflows/refresh.yml/runs?per_page=5",
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!r.ok) throw Error("Workflow status unavailable");
    const data = await r.json();
    const run = data.workflow_runs?.find(
      (r: { conclusion: string; status: string }) =>
        r.status === "completed" && r.conclusion === "success",
    );
    return Response.json({
      snapshotAt: snapshot.refreshedAt,
      lastSuccessfulCheck: run?.updated_at ?? null,
      workflowUrl:
        run?.html_url ??
        "https://github.com/colbster255/re-model-radar/actions",
      latestConclusion: data.workflow_runs?.[0]?.conclusion ?? null,
    });
  } catch {
    return Response.json({
      snapshotAt: snapshot.refreshedAt,
      lastSuccessfulCheck: null,
      latestConclusion: null,
      workflowUrl: "https://github.com/colbster255/re-model-radar/actions",
    });
  }
}
