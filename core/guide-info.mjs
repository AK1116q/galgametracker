// Review methods, not the number of links alone, determine the displayed status.
export function reviewInfo(pack, routeId) {
  const reviews = pack.reviews.filter(
    (r) => !routeId || r.routeIds.includes(routeId),
  );
  const covered = (method) =>
    (routeId ? [routeId] : pack.routes.map((r) => r.id)).every((id) =>
      reviews.some((r) => r.method === method && r.routeIds.includes(id)),
    );
  const sourceCount = new Set(
    pack.sources
      .filter((s) => s.kind === "public_reference")
      .map((s) => s.reference),
  ).size;
  let label = "尚未核验";
  if (pack.synthetic) label = "体验用虚构示例";
  else if (pack.status === "withdrawn") label = "已撤回";
  else if (pack.status === "verified" && covered("playtest"))
    label = "实机验证";
  else if (covered("source_crosscheck") && sourceCount >= 2)
    label = "多来源交叉核对 · 未实机";
  else if (sourceCount === 1) label = "单来源整理 · 未实机";
  else if (sourceCount > 1) label = "多来源整理 · 待交叉核对";
  return {
    label,
    sourceCount,
    date:
      reviews
        .map((r) => r.date)
        .sort()
        .at(-1) ?? "暂无核对记录",
  };
}

export function normalizeLocator(value) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(
      /(\d{1,2})\s*(?:月|\/|-)\s*(\d{1,2})\s*日?/g,
      (_, m, d) => `${Number(m)}月${Number(d)}日`,
    )
    .replace(/\s+/g, "");
}

export function findGuideNodes(nodes, query) {
  const term = normalizeLocator(query.trim());
  if (!term) return [];
  return nodes.flatMap(({ choice }, index) =>
    normalizeLocator(
      [
        choice.locator,
        choice.prompt,
        ...choice.options.map((o) => o.text),
      ].join(" "),
    ).includes(term)
      ? [
          {
            id: choice.id,
            index,
            locator: choice.locator,
            prompt: choice.prompt,
          },
        ]
      : [],
  );
}
