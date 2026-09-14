import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guidePath } from "../core/guide.mjs";
const pack = JSON.parse(
  readFileSync(
    new URL("../data/wa2/kazusa-coda.route.json", import.meta.url),
    "utf8",
  ),
);
test("Kazusa path matches both sources and satisfies six affection flags", () => {
  const before = JSON.stringify(pack);
  const path = guidePath(pack, "kazusa-true");
  const ordinals = path.nodes.map(
    (n) => n.choice.options.findIndex((o) => o.id === n.optionId) + 1,
  );
  assert.deepEqual(ordinals, [2, 2, 1, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 2]);
  const affection = [3, 5, 7, 9, 10, 11].filter(
    (i) => ordinals[i] === [2, 1, 1, 1, 2, 1][[3, 5, 7, 9, 10, 11].indexOf(i)],
  ).length;
  assert.equal(affection, 6);
  assert.equal(ordinals[11], 1);
  assert.equal(ordinals[1], 2);
  assert.deepEqual(path.destination, {
    kind: "ending",
    id: "kazusa-true-completed",
  });
  assert.equal(JSON.stringify(pack), before);
});
test("tree stops on unknown conditions or loops instead of manufacturing a target", () => {
  const unknown = structuredClone(pack);
  unknown.choices[0].rules[0].when = { flag: "unobserved", equals: true };
  assert.equal(guidePath(unknown, "kazusa-true").nodes.length, 0);
  assert.equal(guidePath(unknown, "kazusa-true").destination.kind, "unknown");
  const loop = structuredClone(pack);
  loop.choices[0].options[1].next = { kind: "choice", id: "coda-01" };
  assert.equal(guidePath(loop, "kazusa-true").destination.id, "cycle");
});
