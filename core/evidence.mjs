import editorial from "../data/editorial/evidence.json" with { type: "json" };
export { editorial };
export function routeIssues(pack, routeId, choiceId) {
  return editorial.issues.filter(
    (issue) =>
      issue.packKeys.includes(`${pack.id}@${pack.revision}`) &&
      issue.routeIds.includes(routeId) &&
      (!choiceId || issue.choiceIds.includes(choiceId)),
  );
}
export function stepSources(pack, routeId, choiceId) {
  const choice = pack.choices.find((c) => c.id === choiceId);
  return (choice?.rules ?? [])
    .filter((r) => r.routeId === routeId)
    .map((r) => ({
      source: pack.sources.find((s) => s.id === r.sourceId),
      locator: r.sourceLocator,
    }));
}
