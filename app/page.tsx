import snapshot from "@/data/radar.json";
import { datasetSchema } from "@/lib/schema";
import { rankModels } from "@/lib/scoring";
import Dashboard from "@/components/dashboard";
// Re-evaluate evidence age even when upstream feeds have no material changes.
export const revalidate = 3600;
export default function Page() {
  const data = datasetSchema.parse(snapshot);
  const { refreshedAt, evidence, variants, sources } = data;
  return (
    <Dashboard
      rows={rankModels(data)}
      data={{
        refreshedAt,
        evidence,
        variants,
        sources,
        evaluatedAt: new Date().toISOString(),
      }}
    />
  );
}
