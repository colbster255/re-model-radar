import type { Evidence, Model, Variant } from "../schema";
export type Batch = {
  models?: Model[];
  evidence?: Evidence[];
  variants?: Variant[];
  message: string;
};
export type Adapter = {
  id: string;
  name: string;
  url: string;
  run: (models: Model[], variants?: Variant[]) => Promise<Batch>;
};
export function newModel(
  id: string,
  name: string,
  card: string,
  family: string,
  openWeight = false,
): Model {
  const now = new Date().toISOString();
  return {
    id,
    name,
    card,
    family,
    openWeight,
    context: null,
    toolSupport: "unknown",
    architecture: "Unverified",
    providers: [],
    discoveredAt: now,
    updatedAt: now,
    releaseDate: null,
  };
}
