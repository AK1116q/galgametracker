export function makeDraft() {
  return {
    gameId: "white-album-2",
    title: "白色相簿2",
    release: "",
    route: "",
    source: "",
    permission: "",
    ending: "",
    steps: [
      {
        id: crypto.randomUUID(),
        locator: "",
        prompt: "",
        options: ["", ""],
        recommended: 0,
      },
    ],
  };
}

// A linear verified path, not a simulation of every possible branch in the game.
// Off-path choices are unknown, never silently converted into game endings.
export function draftToPack(draft) {
  const required = [
    draft.title,
    draft.release,
    draft.route,
    draft.source,
    draft.permission,
    draft.ending,
  ];
  if (required.some((v) => !v.trim()))
    throw new Error("请补齐游戏版本、目标路线、来源、使用依据和结局记录名称。");
  if (!draft.steps.length) throw new Error("至少添加一个关键选择。");
  for (const [i, step] of draft.steps.entries()) {
    if (
      !step.locator.trim() ||
      !step.prompt.trim() ||
      step.options.length < 2 ||
      step.options.some((o) => !o.trim())
    )
      throw new Error(`第 ${i + 1} 步还没有填写完整。`);
    if (
      !Number.isInteger(step.recommended) ||
      step.recommended < 0 ||
      step.recommended >= step.options.length
    )
      throw new Error(`第 ${i + 1} 步请选择推荐选项。`);
  }
  const suffix = crypto.randomUUID().slice(0, 8);
  return {
    schemaVersion: "0.1",
    id: `local-${suffix}`,
    revision: 1,
    synthetic: false,
    status: "draft",
    game: {
      id:
        draft.gameId === "custom-game"
          ? `custom-${Array.from(draft.title.trim())
              .reduce(
                (hash, char) => (hash * 31 + char.codePointAt(0)) >>> 0,
                0,
              )
              .toString(16)}`
          : draft.gameId,
      title: draft.title.trim(),
      aliases:
        draft.gameId === "white-album-2" ? ["WA2", "白2", "WHITE ALBUM 2"] : [],
    },
    release: {
      id: `release-${suffix}`,
      label: draft.release.trim(),
      locale: "zh-CN",
    },
    sources: [
      {
        id: "source-main",
        kind: "own_notes",
        reference: draft.source.trim(),
        permission: draft.permission.trim(),
      },
    ],
    routes: [
      {
        id: "route-main",
        safeLabel: draft.route.trim(),
        entryChoiceId: "choice-1",
        requiredEndingIds: [],
      },
    ],
    choices: draft.steps.map((step, i) => ({
      id: `choice-${i + 1}`,
      locator: step.locator.trim(),
      prompt: step.prompt.trim(),
      options: step.options.map((text, j) => ({
        id: `option-${j + 1}`,
        text: text.trim(),
        next:
          j !== step.recommended
            ? { kind: "unknown", id: "off-path" }
            : i === draft.steps.length - 1
              ? { kind: "ending", id: "ending-main" }
              : { kind: "choice", id: `choice-${i + 2}` },
      })),
      rules: [
        {
          routeId: "route-main",
          when: { all: [] },
          recommendedOptionIds: [`option-${step.recommended + 1}`],
          sourceId: "source-main",
          sourceLocator: step.locator.trim(),
        },
      ],
    })),
    endings: [
      {
        id: "ending-main",
        safeLabel: "本条路线结局",
        hiddenTitle: draft.ending.trim(),
        spoilerLevel: 2,
      },
    ],
    reviews: [],
  };
}
