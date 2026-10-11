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
  const unique = [
    ...new Map(models.map((m) => [m.id.toLowerCase(), m])).values(),
  ];
  const exact = unique.filter((m) => m.id.toLowerCase() === name.toLowerCase());
  if (exact.length === 1) return exact[0];
  const candidates = unique.filter(
    (m) => canonical(m.name) === canonical(name),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}
