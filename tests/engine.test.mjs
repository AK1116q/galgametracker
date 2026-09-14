import test from "node:test";
import assert from "node:assert/strict";
import demo from "../data/examples/demo.route.json" with { type: "json" };
import wa2 from "../data/wa2/setsuna-cc.route.json" with { type: "json" };
import {
  evaluate,
  createSession,
  replay,
  recordChoice,
  recommend,
  undo,
  confirmEnding,
  skipChoice,
} from "../core/engine.mjs";
import {
  emptyLibrary,
  validateBackup,
  mergeBackup,
  packKey,
} from "../core/backup.mjs";

test("unknown conditions do not silently become false", () => {
  const state = {
    choices: {},
    flags: {},
    counters: {},
    completedEndingIds: [],
  };
  assert.equal(evaluate({ flag: "hidden", equals: false }, state), null);
  assert.equal(
    evaluate(
      { all: [{ endingId: "missing" }, { flag: "hidden", equals: false }] },
      state,
    ),
    false,
  );
  assert.equal(
    evaluate(
      { any: [{ endingId: "missing" }, { flag: "hidden", equals: false }] },
      state,
    ),
    null,
  );
});

test("conflicting and unknown rules block recommendations", () => {
  const p = structuredClone(demo);
  const s = createSession(p, "route-a");
  p.choices[0].rules.push({
    ...p.choices[0].rules[0],
    recommendedOptionIds: ["garden"],
  });
  assert.equal(recommend(p, s).status, "conflict");
  p.choices[0].rules[2].when = { flag: "unknown", equals: false };
  assert.equal(recommend(p, s).status, "unknown");
});

test("history replays, undoes, and requires explicit ending confirmation", () => {
  const start = createSession(demo, "route-a");
  const step = recordChoice(demo, start, "library");
  assert.equal(recommend(demo, step).optionIds[0], "stay");
  const end = recordChoice(demo, step, "stay");
  assert.equal(end.completed, false);
  assert.equal(confirmEnding(demo, end).completed, true);
  assert.equal(replay(demo, undo(end)).position.id, "choice-2");
  assert.throws(() => recordChoice(demo, start, "stay"));
  assert.throws(() => confirmEnding(demo, start));
  assert.throws(() => replay({ ...demo, revision: 2 }, step));
});

test("WA2 source path includes inherited choices and reaches the intended endpoint", () => {
  assert.throws(() => createSession(wa2, "setsuna-cc"));
  let s = createSession(wa2, "setsuna-cc", ["ic-completed"]);
  // The source guide starts Setsuna at Save03: the first five choices must be retained.
  const sourceSequence = [2, 1, 2, 1, 2, 2, 1, 1, 2, 1, 1, 1, 2, 3, 2, 2];
  for (const ordinal of sourceSequence) {
    assert.deepEqual(recommend(wa2, s).optionIds, [`option-${ordinal}`]);
    s = recordChoice(wa2, s, `option-${ordinal}`);
  }
  assert.equal(replay(wa2, s).position.id, "setsuna-cc-completed");
  assert.equal(s.events.length, 16);
  assert.equal(s.completed, false);
});

test("WA2 retained source path meets independently described affection thresholds", () => {
  // Derivation from the Chinese condition guide, not a general WA2 simulator.
  // Bilibili and the Chinese condition guide both require all three other
  // heroines to have at least one point. Counters are not shown to users.
  const scores = { setsuna: 0, chiaki: 0, mari: 0, koharu: 0 };
  const effects = {
    "cc-01": { "option-2": { chiaki: 1 } },
    "cc-02": { "option-1": { setsuna: 1 } },
    "cc-03": { "option-2": { mari: 1 } },
    "cc-04": { "option-1": { koharu: 1 } },
    "cc-05": { "option-1": { chiaki: 1 } },
    "cc-06": { "option-1": { koharu: 1 }, "option-2": { setsuna: 1 } },
    "cc-07": { "option-1": { setsuna: 1 }, "option-2": { mari: 1 } },
    "cc-09": { "option-1": { chiaki: 1 }, "option-2": { setsuna: 1 } },
    "cc-10": { "option-1": { setsuna: 1, koharu: 1 } },
    "cc-11": { "option-1": { setsuna: 1 }, "option-2": { chiaki: 1 } },
    "cc-12": { "option-1": { setsuna: 1 }, "option-2": { mari: 1 } },
    "cc-13": { "option-2": { koharu: 1 } },
  };
  for (const choice of wa2.choices) {
    const optionId = choice.rules[0].recommendedOptionIds[0];
    for (const [key, value] of Object.entries(
      effects[choice.id]?.[optionId] ?? {},
    ))
      scores[key] += value;
  }
  assert.ok(
    scores.setsuna >= 5 &&
      scores.chiaki >= 1 &&
      scores.mari >= 1 &&
      scores.koharu >= 1,
  );
  assert.deepEqual(
    wa2.choices.find((c) => c.id === "cc-09").rules[0].recommendedOptionIds,
    ["option-2"],
  );
});

test("off-path WA2 option stays unknown and cannot create a false ending", () => {
  const s = recordChoice(
    wa2,
    createSession(wa2, "setsuna-cc", ["ic-completed"]),
    "option-1",
  );
  assert.equal(replay(wa2, s).position.kind, "unknown");
  assert.throws(() => confirmEnding(wa2, s));
  assert.equal(replay(wa2, undo(s)).position.id, "cc-01");
});

test("only explicitly optional choices can be skipped", () => {
  let s = createSession(wa2, "setsuna-cc", ["ic-completed"]);
  assert.throws(() => skipChoice(wa2, s));
  for (let i = 0; i < 15; i++)
    s = recordChoice(wa2, s, recommend(wa2, s).optionIds[0]);
  const skipped = skipChoice(wa2, s);
  assert.equal(replay(wa2, skipped).position.kind, "ending");
  assert.equal(replay(wa2, undo(skipped)).position.id, "cc-16");
});

test("backup rejects tampered progress without touching existing data", () => {
  const initial = {
    ...emptyLibrary(),
    sessions: [createSession(demo, "route-a")],
  };
  const bad = structuredClone(initial);
  bad.sessions[0].events = [
    { choiceId: "choice-2", optionId: "stay", at: new Date().toISOString() },
  ];
  assert.throws(() => validateBackup(bad, [demo]));
  assert.equal(initial.sessions[0].events.length, 0);
  const future = structuredClone(initial);
  future.version = 2;
  assert.throws(() => mergeBackup(initial, future, [demo]));
});

test("conflicting pack versions and sessions cannot silently overwrite data", () => {
  const current = {
    ...emptyLibrary(),
    packs: [demo],
    sessions: [createSession(demo, "route-a")],
  };
  const incoming = structuredClone(current);
  incoming.packs[0].game.title = "Altered";
  assert.throws(() => mergeBackup(current, incoming, [demo]));
  const other = structuredClone(current);
  other.sessions[0] = recordChoice(demo, other.sessions[0], "library");
  assert.throws(() => mergeBackup(current, other, [demo]));
  assert.equal(mergeBackup(current, current, [demo]).sessions.length, 1);
});

test("confirmed ending collection survives independent session rewind", () => {
  const end = confirmEnding(
    demo,
    recordChoice(
      demo,
      recordChoice(demo, createSession(demo, "route-a"), "library"),
      "stay",
    ),
  );
  const store = {
    ...emptyLibrary(),
    sessions: [undo(end)],
    completed: [
      {
        packKey: packKey(demo),
        endingId: "ending-a",
        at: new Date().toISOString(),
      },
    ],
  };
  assert.equal(validateBackup(store, [demo]).completed.length, 1);
});
