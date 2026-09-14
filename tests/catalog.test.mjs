import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { guidePath } from "../core/guide.mjs";
import { createSession, recordChoice, replay } from "../core/engine.mjs";
const dir = new URL("../data/wa2/", import.meta.url);
const packs = readdirSync(dir).map((f) =>
  JSON.parse(readFileSync(new URL(f, dir), "utf8")),
);
const byRoute = (id) => packs.find((p) => p.routes.some((r) => r.id === id));
const decisions = (id) =>
  Object.fromEntries(
    guidePath(byRoute(id), id).nodes.map((n) => [
      Number(n.choice.id.split("-")[1]),
      Number(n.optionId.split("-")[1]),
    ]),
  );
test("catalog contains all six CC and four Coda main-game endings with terminating paths", () => {
  assert.equal(packs.filter((p) => p.release.id === "wa2-pc-cc").length, 6);
  assert.equal(packs.filter((p) => p.release.id === "wa2-pc-coda").length, 4);
  for (const p of packs) {
    const r = p.routes[0];
    const path = guidePath(p, r.id);
    assert.equal(path.destination.kind, "ending", r.id);
    assert.equal(path.nodes.length, p.choices.length, r.id);
    assert.ok(!r.requiredEndingIds.includes(path.destination.id));
  }
});
test("new CC paths meet independent affection and branch conditions", () => {
  for (const id of ["koharu", "mari", "chiaki-ne", "chiaki-te", "ski"]) {
    const d = decisions(id);
    const mari =
      Number(d[3] === 2) +
      Number(d[7] === 2) +
      Number(d[8] === 2 && d[12] === 2);
    const chiaki =
      Number(d[1] === 2) +
      Number(d[5] === 1) +
      Number(d[9] === 1) +
      Number(d[11] === 2);
    const koharu =
      Number(d[4] === 1) +
      Number(d[6] === 1) +
      Number(d[10] === 1) +
      Number(d[13] === 2);
    if (id === "mari") {
      assert.equal(mari, 3);
      assert.equal(d[8], 2);
      assert.equal(d[14], 2);
      assert.equal(d[16], 2);
    }
    if (id === "koharu") {
      assert.ok(koharu >= 3);
      assert.equal(d[8], 1);
      assert.equal(d[15], 1);
    }
    if (id.startsWith("chiaki")) {
      assert.ok(chiaki >= 3);
      assert.equal(d[9], 1);
      assert.equal(d[11], 2);
      assert.equal(d[14], 1);
      assert.equal(d[1], id === "chiaki-te" ? 1 : 2);
    }
    if (id === "ski") {
      assert.equal(mari, 0);
      assert.equal(d[14], 3);
      assert.equal(d[15], 2);
      assert.equal(d[16], undefined);
    }
  }
  assert.throws(
    () => createSession(byRoute("chiaki-te"), "chiaki-te", ["ic-completed"]),
    /前置/,
  );
});
test("Coda paths respect conditional skipping and explicit CG-equivalent ending", () => {
  const snow = decisions("setsuna-true");
  assert.deepEqual(
    Object.keys(snow).map(Number),
    [1, 2, 3, 5, 7, 8, 9, 11, 12, 13, 14],
  );
  assert.equal(snow[3], 2);
  assert.equal(snow[5], 1);
  assert.equal(snow[9], 1);
  assert.equal(snow[12], 2);
  assert.equal(snow[14], 1);
  for (const id of ["normal", "affair"]) {
    const d = decisions(id);
    assert.equal(d[2], 1);
    for (const n of [3, 4, 11, 12]) assert.equal(d[n], undefined);
    assert.equal(d[13], id === "normal" ? 2 : 1);
  }
  const p = byRoute("affair");
  let s = createSession(p, "affair", ["setsuna-cc-completed"]);
  for (const n of guidePath(p, "affair").nodes.slice(0, -1))
    s = recordChoice(p, s, n.optionId);
  assert.deepEqual(
    replay(p, recordChoice(p, s, "option-1")).position,
    replay(p, recordChoice(p, s, "option-2")).position,
  );
});
