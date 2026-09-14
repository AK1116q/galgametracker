import { createSession, replay, recommend, recordChoice } from "./engine.mjs";

// A read-only hypothetical path. Prerequisites here never become player progress.
export function guidePath(pack, routeId) {
  const route = pack.routes.find((r) => r.id === routeId);
  if (!route) throw new Error("路线不存在");
  let session = createSession(pack, routeId, route.requiredEndingIds);
  const nodes = [],
    seen = new Set();
  while (replay(pack, session).position.kind === "choice") {
    const id = replay(pack, session).position.id;
    if (seen.has(id))
      return { nodes, destination: { kind: "unknown", id: "cycle" } };
    seen.add(id);
    const result = recommend(pack, session);
    if (result.status !== "recommended" || result.optionIds.length !== 1)
      return { nodes, destination: { kind: "unknown", id: result.status } };
    const choice = pack.choices.find((c) => c.id === id);
    nodes.push({ choice, optionId: result.optionIds[0] });
    session = recordChoice(pack, session, result.optionIds[0]);
  }
  return { nodes, destination: replay(pack, session).position };
}
