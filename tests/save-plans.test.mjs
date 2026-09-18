import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import plans from "../data/editorial/save-plans.json" with { type: "json" };
import { guidePath } from "../core/guide.mjs";
test("curated save checkpoints share identical recorded prefixes and prerequisites", () => {
  const packs = ["wa2", "catalog"].flatMap((dir) =>
    readdirSync(`data/${dir}`)
      .filter((f) => f.endsWith(".route.json"))
      .map((f) => JSON.parse(readFileSync(`data/${dir}/${f}`, "utf8"))),
  );
  for (const plan of plans) {
    const paths = plan.targets.map((t) => {
      const pack = packs.find((p) => `${p.id}@${p.revision}` === t.packKey);
      assert.ok(pack, t.packKey);
      const route = pack.routes.find((r) => r.id === t.routeId);
      assert.ok(route);
      const path = guidePath(pack, t.routeId);
      assert.equal(path.nodes[plan.prefixLength].choice.id, t.choiceId);
      return {
        required: route.requiredEndingIds,
        prefix: path.nodes
          .slice(0, plan.prefixLength)
          .map(({ choice, optionId }) => [
            choice.locator,
            choice.prompt,
            choice.options.find((o) => o.id === optionId).text,
          ]),
      };
    });
    for (const path of paths.slice(1))
      assert.deepEqual(path, paths[0], plan.id);
  }
});
