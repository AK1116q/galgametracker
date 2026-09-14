// Pure domain logic, shared by the Web client and a future mini-program.
export function evaluate(condition, state) {
  if ("all" in condition) {
    const results = condition.all.map((c) => evaluate(c, state));
    return results.includes(false)
      ? false
      : results.includes(null)
        ? null
        : true;
  }
  if ("any" in condition) {
    const results = condition.any.map((c) => evaluate(c, state));
    return results.includes(true)
      ? true
      : results.includes(null)
        ? null
        : false;
  }
  if ("choiceId" in condition) {
    return Object.hasOwn(state.choices, condition.choiceId)
      ? state.choices[condition.choiceId] === condition.optionId
      : null;
  }
  if ("endingId" in condition)
    return state.completedEndingIds.includes(condition.endingId);
  if ("flag" in condition)
    return Object.hasOwn(state.flags, condition.flag)
      ? state.flags[condition.flag] === condition.equals
      : null;
  if ("counter" in condition)
    return Object.hasOwn(state.counters, condition.counter)
      ? state.counters[condition.counter] >= condition.atLeast
      : null;
  return null;
}

export function createSession(pack, routeId, completedEndingIds = []) {
  const route = pack.routes.find((r) => r.id === routeId);
  if (!route) throw new Error("找不到这条路线。");
  if (route.requiredEndingIds.some((id) => !completedEndingIds.includes(id)))
    throw new Error("请先确认前置路线已完成。");
  return {
    id: crypto.randomUUID(),
    packId: pack.id,
    revision: pack.revision,
    releaseId: pack.release.id,
    routeId,
    initialEndingIds: [...completedEndingIds],
    events: [],
    completed: false,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function replay(pack, session) {
  if (
    pack.id !== session.packId ||
    pack.revision !== session.revision ||
    pack.release.id !== session.releaseId
  )
    throw new Error("攻略版本与存档不一致，请保留原存档。");
  const route = pack.routes.find((r) => r.id === session.routeId);
  if (!route) throw new Error("存档中的路线不存在。");
  if (
    route.requiredEndingIds.some((id) => !session.initialEndingIds.includes(id))
  )
    throw new Error("存档缺少前置结局。");
  const state = {
    choices: {},
    completedEndingIds: session.initialEndingIds,
    flags: {},
    counters: {},
  };
  let position = { kind: "choice", id: route.entryChoiceId };
  for (const event of session.events) {
    if (position.kind !== "choice" || event.choiceId !== position.id)
      throw new Error("选择记录顺序不正确，无法恢复。");
    const choice = pack.choices.find((c) => c.id === position.id);
    if (event.optionId === "__skip__" && choice?.skipTo) {
      position = choice.skipTo;
      continue;
    }
    const option = choice?.options.find((o) => o.id === event.optionId);
    if (!option) throw new Error("选择记录引用了不存在的选项。");
    state.choices[event.choiceId] = event.optionId;
    position = option.next;
  }
  if (session.completed && position.kind !== "ending")
    throw new Error("未到达结局的记录不能标为通关。");
  return { state, position };
}

export function recommend(pack, session) {
  const { state, position } = replay(pack, session);
  if (position.kind !== "choice")
    return { status: position.kind, optionIds: [] };
  const choice = pack.choices.find((c) => c.id === position.id);
  if (!choice) return { status: "unsupported", optionIds: [] };
  const rules = choice.rules.filter((r) => r.routeId === session.routeId);
  const evaluations = rules.map((rule) => ({
    rule,
    match: evaluate(rule.when, state),
  }));
  // A still-unknown competing rule may change the result. Do not guess.
  if (evaluations.some((e) => e.match === null))
    return { status: "unknown", optionIds: [] };
  const matches = evaluations.filter((e) => e.match === true);
  if (!matches.length) return { status: "unknown", optionIds: [] };
  const signatures = new Set(
    matches.map((e) => [...e.rule.recommendedOptionIds].sort().join("|")),
  );
  if (signatures.size > 1) return { status: "conflict", optionIds: [] };
  return {
    status: "recommended",
    optionIds: matches[0].rule.recommendedOptionIds,
  };
}

export function recordChoice(pack, session, optionId) {
  if (session.completed) throw new Error("这次游玩已结束，请开始新的记录。");
  const { position } = replay(pack, session);
  if (position.kind !== "choice") throw new Error("已经到达结局确认步骤。");
  const choice = pack.choices.find((c) => c.id === position.id);
  if (!choice?.options.some((o) => o.id === optionId))
    throw new Error("请选择当前画面中的选项。");
  return {
    ...session,
    events: [
      ...session.events,
      { choiceId: choice.id, optionId, at: new Date().toISOString() },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function undo(session) {
  return {
    ...session,
    events: session.events.slice(0, -1),
    completed: false,
    updatedAt: new Date().toISOString(),
  };
}

export function skipChoice(pack, session) {
  const { position } = replay(pack, session);
  const choice = pack.choices.find((c) => c.id === position.id);
  if (session.completed || position.kind !== "choice" || !choice?.skipTo)
    throw new Error("当前节点不能跳过。");
  return {
    ...session,
    events: [
      ...session.events,
      {
        choiceId: choice.id,
        optionId: "__skip__",
        at: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function confirmEnding(pack, session) {
  if (replay(pack, session).position.kind !== "ending")
    throw new Error("还没有到达结局确认步骤。");
  return { ...session, completed: true, updatedAt: new Date().toISOString() };
}
