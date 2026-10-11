// Deliberately preserve versions, sizes and suffixes. Never fuzzy-match checkpoints.
export function canonical(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
export function derivesFrom(baseId: string, declaredBases: string[]) {
  return declaredBases.some((id) => id.toLowerCase() === baseId.toLowerCase());
}
export function matchModel<T extends { id: string; name: string }>(
  name: string,
  models: T[],
): T | undefined {
  return models.find(
    (m) =>
      canonical(m.id) === canonical(name) ||
      canonical(m.name) === canonical(name),
  );
}
