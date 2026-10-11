import snapshot from "@/data/radar.json";
import { datasetSchema } from "@/lib/schema";
import { rankModels } from "@/lib/scoring";
import Dashboard from "@/components/dashboard";
export default function Page() {
  const data = datasetSchema.parse(snapshot);
  return <Dashboard rows={rankModels(data)} data={data} />;
}
