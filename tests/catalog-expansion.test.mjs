import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  createSession,
  recordChoice,
  replay,
  skipChoice,
} from "../core/engine.mjs";
import { guidePath } from "../core/guide.mjs";

const directory = new URL("../data/catalog/", import.meta.url);
const packs = readdirSync(directory)
  .filter((name) => name.endsWith(".route.json"))
  .map((name) => JSON.parse(readFileSync(new URL(name, directory), "utf8")))
  .filter((pack) =>
    pack.reviews.some((review) => review.date === "2026-11-12"),
  );

for (const pack of packs) {
  test(`${pack.game.id}: every guide can be recorded and restored without bypassing prerequisites`, () => {
    for (const route of pack.routes) {
      for (const missing of route.requiredEndingIds) {
        assert.throws(
          () =>
            createSession(
              pack,
              route.id,
              route.requiredEndingIds.filter((id) => id !== missing),
            ),
          /前置/,
        );
      }
      const path = guidePath(pack, route.id);
      for (const skipOptional of [false, true]) {
        let session = createSession(pack, route.id, route.requiredEndingIds);
        for (const node of path.nodes) {
          assert.equal(replay(pack, session).position.id, node.choice.id);
          session =
            skipOptional && node.choice.skipTo
              ? skipChoice(pack, session)
              : recordChoice(pack, session, node.optionId);
          session = JSON.parse(JSON.stringify(session));
        }
        assert.deepEqual(replay(pack, session).position, {
          kind: "ending",
          id: `${route.id}-end`,
        });
        assert.equal(
          session.completed,
          false,
          "Viewing a guide must not claim a real playthrough is complete",
        );
      }
    }
  });
}
