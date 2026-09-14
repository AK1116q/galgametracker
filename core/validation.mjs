import Ajv from "ajv";
import schema from "../schemas/route-pack.schema.json" with { type: "json" };
const checkSchema = new Ajv({ allErrors: true, strict: true }).compile(schema);

export function validatePack(pack) {
  if (!checkSchema(pack)) {
    return checkSchema.errors.map(
      (e) => `${e.instancePath || "/"} ${e.message}`,
    );
  }
  const errors = [];
  function index(items, label) {
    const result = new Map();
    for (const item of items) {
      if (result.has(item.id)) errors.push(`${label}: duplicate id ${item.id}`);
      result.set(item.id, item);
    }
    return result;
  }
  const routes = index(pack.routes, "routes");
  const choices = index(pack.choices, "choices");
  const endings = index(pack.endings, "endings");
  const sources = index(pack.sources, "sources");
  const options = new Map(
    pack.choices.map((c) => [c.id, index(c.options, `choice ${c.id} options`)]),
  );
  const ref = (map, id, label) => {
    if (!map.has(id)) errors.push(`${label}: unknown reference ${id}`);
  };
  function condition(c) {
    if (c.all) c.all.forEach(condition);
    if (c.any) c.any.forEach(condition);
    if (c.choiceId) {
      ref(choices, c.choiceId, "condition choice");
      ref(options.get(c.choiceId) ?? new Map(), c.optionId, "condition option");
    }
    if (c.endingId) ref(endings, c.endingId, "condition ending");
  }
  for (const route of pack.routes) {
    ref(choices, route.entryChoiceId, "route entry");
    route.requiredEndingIds.forEach((id) =>
      ref(endings, id, "route prerequisite"),
    );
  }
  for (const choice of pack.choices) {
    for (const option of choice.options) {
      if (option.next.kind !== "unknown")
        ref(
          option.next.kind === "choice" ? choices : endings,
          option.next.id,
          "option destination",
        );
    }
    if (choice.skipTo && choice.skipTo.kind !== "unknown")
      ref(
        choice.skipTo.kind === "choice" ? choices : endings,
        choice.skipTo.id,
        "skip destination",
      );
    for (const rule of choice.rules) {
      ref(routes, rule.routeId, "rule route");
      ref(sources, rule.sourceId, "rule source");
      rule.recommendedOptionIds.forEach((id) =>
        ref(options.get(choice.id), id, "recommended option"),
      );
      condition(rule.when);
    }
  }
  for (const review of pack.reviews) {
    review.routeIds.forEach((id) => ref(routes, id, "review route"));
    const date = new Date(`${review.date}T00:00:00Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== review.date
    ) {
      errors.push(`review date: invalid date ${review.date}`);
    }
  }
  const hasSyntheticSource = pack.sources.some((s) => s.kind === "synthetic");
  if (!pack.synthetic && hasSyntheticSource)
    errors.push("real pack cannot contain synthetic sources");
  if (pack.synthetic && pack.status !== "draft")
    errors.push("synthetic pack must remain draft");
  if (pack.status === "verified") {
    const covered = new Set(
      pack.reviews
        .filter((r) => r.method !== "source_crosscheck")
        .flatMap((r) => r.routeIds),
    );
    for (const route of pack.routes) {
      if (!covered.has(route.id))
        errors.push(`verified pack requires review for ${route.id}`);
    }
  }
  return errors;
}
