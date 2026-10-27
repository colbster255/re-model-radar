import snapshot from "@/data/radar.json";
import { datasetSchema } from "@/lib/schema";
import { topTen } from "@/lib/top-ten";
import Radar from "@/components/radar";
export const revalidate = 3600;
export default function Page() {
  const data = datasetSchema.parse(snapshot);
  const evaluatedAt = new Date().toISOString();
  const now = Date.parse(evaluatedAt);
  return (
    <Radar
      {...topTen(data, now)}
      sources={data.sources}
      snapshotAt={data.refreshedAt}
      evaluatedAt={evaluatedAt}
    />
  );
}
