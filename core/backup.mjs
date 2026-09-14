import { validatePack } from "./validation.mjs";
import { replay } from "./engine.mjs";

export const STORAGE_KEY = "galgametracker.web.v1";
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const emptyLibrary = () => ({
  format: "galgametracker-backup",
  version: 1,
  packs: [],
  sessions: [],
  completed: [],
});
export const packKey = (pack) => `${pack.id}@${pack.revision}`;
export const sessionPackKey = (session) =>
  `${session.packId}@${session.revision}`;

export function validateBackup(data, builtins = []) {
  if (
    !data ||
    data.format !== "galgametracker-backup" ||
    data.version !== 1 ||
    !Array.isArray(data.packs) ||
    !Array.isArray(data.sessions) ||
    !Array.isArray(data.completed)
  )
    throw new Error("不是受支持的路线手记备份。");
  if (data.packs.length > 500 || data.sessions.length > 5000)
    throw new Error("备份内容过多，请拆分导入。");
  const packs = new Map(builtins.map((p) => [packKey(p), p]));
  const imported = new Set();
  for (const pack of data.packs) {
    const errors = validatePack(pack);
    if (errors.length) throw new Error(`攻略数据不完整：${errors[0]}`);
    const key = packKey(pack);
    if (imported.has(key)) throw new Error("备份含重复的攻略版本。");
    imported.add(key);
    if (
      packs.has(key) &&
      JSON.stringify(packs.get(key)) !== JSON.stringify(pack)
    )
      throw new Error("备份试图覆盖内置攻略。");
    packs.set(key, pack);
  }
  const ids = new Set();
  for (const session of data.sessions) {
    if (
      !session ||
      typeof session.id !== "string" ||
      ids.has(session.id) ||
      !Array.isArray(session.events) ||
      !Array.isArray(session.initialEndingIds) ||
      typeof session.completed !== "boolean" ||
      !Number.isFinite(Date.parse(session.updatedAt)) ||
      !Number.isFinite(Date.parse(session.startedAt))
    )
      throw new Error("游玩记录格式不正确。");
    ids.add(session.id);
    const pack = packs.get(sessionPackKey(session));
    if (!pack) throw new Error("备份缺少游玩记录对应的攻略版本。");
    if (
      session.initialEndingIds.some(
        (id) => !pack.endings.some((e) => e.id === id),
      )
    )
      throw new Error("前置结局记录无效。");
    for (const event of session.events) {
      if (
        !event ||
        typeof event.choiceId !== "string" ||
        typeof event.optionId !== "string" ||
        !Number.isFinite(Date.parse(event.at))
      )
        throw new Error("选择事件格式不正确。");
    }
    replay(pack, session);
  }
  for (const item of data.completed) {
    if (
      !item ||
      typeof item.packKey !== "string" ||
      !Number.isFinite(Date.parse(item.at))
    )
      throw new Error("通关记录格式不正确。");
    const pack = packs.get(item.packKey);
    if (!pack?.endings.some((e) => e.id === item.endingId))
      throw new Error("通关记录缺少对应结局。");
  }
  return data;
}

export function mergeBackup(current, incoming, builtins = []) {
  validateBackup(incoming, builtins);
  const next = structuredClone(current);
  const packs = new Map(
    [...builtins, ...next.packs].map((p) => [packKey(p), p]),
  );
  for (const p of incoming.packs) {
    const old = packs.get(packKey(p));
    if (old && JSON.stringify(old) !== JSON.stringify(p))
      throw new Error("相同版本的攻略内容不同，未导入。请先增加攻略版本号。");
    if (!old) {
      next.packs.push(p);
      packs.set(packKey(p), p);
    }
  }
  for (const session of incoming.sessions) {
    const old = next.sessions.find((s) => s.id === session.id);
    if (old && JSON.stringify(old) !== JSON.stringify(session))
      throw new Error(
        "存在不同内容的同名游玩记录，未覆盖。请保留两份备份后检查。",
      );
    if (!old) next.sessions.push(session);
  }
  for (const item of incoming.completed) {
    if (
      !next.completed.some(
        (c) => c.packKey === item.packKey && c.endingId === item.endingId,
      )
    )
      next.completed.push(item);
  }
  return validateBackup(next, builtins);
}
