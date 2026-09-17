import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { guidePath } from "../core/guide.mjs";
import {
  createSession,
  recordChoice,
  replay,
  skipChoice,
} from "../core/engine.mjs";
import { validatePack } from "../core/validation.mjs";
const dir = new URL("../data/catalog/", import.meta.url);
const packs = readdirSync(dir).map((f) =>
  JSON.parse(readFileSync(new URL(f, dir), "utf8")),
);
const pack = (id) => packs.find((p) => p.game.id === id);
test("five researched works cover 26 terminating paths without claiming playtests", () => {
  assert.equal(packs.length, 5);
  assert.equal(
    packs.reduce((n, p) => n + p.routes.length, 0),
    26,
  );
  for (const p of packs) {
    assert.deepEqual(validatePack(p), []);
    assert.equal(p.status, "source_checked");
    assert.ok(p.sources.length >= 2);
    for (const r of p.routes) {
      const path = guidePath(p, r.id);
      assert.deepEqual(path.destination, { kind: "ending", id: `${r.id}-end` });
      assert.ok(!r.requiredEndingIds.includes(path.destination.id));
      if (r.requiredEndingIds.length)
        assert.throws(() => createSession(p, r.id, []), /前置/);
    }
  }
});
test("conditional branches and title-menu endings retain their prerequisites", () => {
  const senren = pack("senren-banka");
  for (const id of ["mako", "murasame"]) {
    const path = guidePath(senren, id);
    assert.equal(path.nodes.length, 7);
    assert.ok(path.nodes.every((n) => n.choice.locator !== "钓鱼分支"));
  }
  const atri = pack("atri");
  assert.deepEqual(atri.routes.find((r) => r.id === "true").requiredEndingIds, [
    "good-end",
    "bad-end",
  ]);
  assert.equal(guidePath(atri, "true").nodes[0].choice.kind, "instruction");
  assert.equal(guidePath(pack("saya-no-uta"), "ending-one").nodes.length, 1);
  const sabbat = pack("sabbat-of-the-witch");
  assert.deepEqual(
    sabbat.routes.find((r) => r.id === "nene-restart").requiredEndingIds,
    ["nene-end"],
  );
  const riddle = pack("riddle-joker");
  let s = createSession(riddle, "nanami", []);
  const path = guidePath(riddle, "nanami");
  for (const node of path.nodes)
    s = node.choice.skipTo
      ? skipChoice(riddle, s)
      : recordChoice(riddle, s, node.optionId);
  assert.deepEqual(replay(riddle, s).position, {
    kind: "ending",
    id: "nanami-end",
  });
  assert.equal(
    riddle.routes.find((r) => r.id === "normal").requiredEndingIds.length,
    1,
  );
});
