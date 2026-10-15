import test from "node:test";
import assert from "node:assert/strict";
import demo from "../data/examples/demo.route.json" with { type: "json" };
import coda from "../data/wa2/kazusa-coda.route.json" with { type: "json" };
import { routeFromPath, routePathname } from "../core/urls.mjs";
import {
  createSession,
  replay,
  recordChoice,
  confirmEnding,
  evaluate,
} from "../core/engine.mjs";
import {
  emptyLibrary,
  mergeBackup,
  validateBackup,
  packKey,
} from "../core/backup.mjs";
import { validatePack } from "../core/validation.mjs";

const when = "2026-10-15T00:00:00.000Z";
const event = (choiceId, optionId) => ({ choiceId, optionId, at: when });

test("malformed, encoded separators and hostile public paths never resolve to another guide", () => {
  const valid = routePathname(coda, "kazusa-true");
  const invalid = [
    null,
    undefined,
    {},
    "/guides/%/pack/1/route/",
    "/guides/%E0%A4%A/pack/1/route/",
    valid.replace("white-album-2", "white-album-2%2F.."),
    valid.replace("white-album-2", "white-album-2%252F.."),
    valid.replace("white-album-2", "%00white-album-2"),
    valid.replace("kazusa-true/", "kazusa-true%3Fview%3Dsettings/"),
    valid.replace("kazusa-true/", "%3Cscript%3Ealert(1)%3C%2Fscript%3E/"),
    `${valid}extra/`,
  ];
  for (const path of invalid)
    assert.equal(routeFromPath(path, [coda]), undefined, String(path));
  assert.equal(routeFromPath(valid, [coda]).route.id, "kazusa-true");
});

test("public paths require the exact game, pack, revision and route tuple", () => {
  const parts = routePathname(coda, "kazusa-true").split("/");
  for (const [index, replacement] of [
    [2, "unknown-game"],
    [3, "unknown-pack"],
    [4, "999999"],
    [4, "01"],
    [4, "1.0"],
    [5, "unknown-route"],
  ]) {
    const altered = [...parts];
    altered[index] = replacement;
    assert.equal(routeFromPath(altered.join("/"), [coda]), undefined);
  }
  assert.equal(
    routeFromPath(routePathname(demo, "route-a"), [demo]),
    undefined,
  );
});

test("invalid imported condition structures are rejected before reaching the rules engine", () => {
  const conditions = [
    null,
    true,
    [],
    { any: [] },
    { all: null },
    { all: [true] },
    { flag: "ready", equals: "false" },
    { counter: "points", atLeast: "2" },
    { all: [], any: [{ endingId: "ending-a" }] },
  ];
  for (const condition of conditions) {
    const pack = structuredClone(demo);
    pack.choices[0].rules[0].when = condition;
    assert.ok(validatePack(pack).length, JSON.stringify(condition));
    assert.throws(
      () => validateBackup({ ...emptyLibrary(), packs: [pack] }),
      /攻略数据不完整/,
    );
  }
});

test("malformed source URLs are rejected before imported source details can crash the page", () => {
  for (const reference of [
    "https://%",
    "https://",
    "http://[invalid-ipv6]",
    "HTTPS://bad host.example/guide",
  ]) {
    const pack = structuredClone(demo);
    pack.sources[0].reference = reference;
    assert.ok(
      validatePack(pack).some((error) => error.includes("invalid HTTP(S) URL")),
      reference,
    );
    assert.throws(
      () => validateBackup({ ...emptyLibrary(), packs: [pack] }),
      /攻略数据不完整/,
    );
  }
  for (const reference of [
    "作者游玩笔记，第 3 页",
    "https://example.com/guide?route=a#ending",
    "http://example.com/%E6%94%BB%E7%95%A5",
    "https://例子.中国/攻略",
  ]) {
    const pack = structuredClone(demo);
    pack.sources[0].reference = reference;
    assert.deepEqual(validatePack(pack), [], reference);
  }
});

test("an import cannot reference a missing entry, skip step, rule choice, or condition ending", () => {
  const mutations = [
    (pack) => {
      pack.routes[0].entryChoiceId = "missing-step";
    },
    (pack) => {
      pack.choices[0].skipTo = { kind: "choice", id: "missing-step" };
    },
    (pack) => {
      pack.choices[0].rules[0].when = {
        all: [{ any: [{ choiceId: "missing-step", optionId: "library" }] }],
      };
    },
    (pack) => {
      pack.choices[0].rules[0].when = { endingId: "missing-ending" };
    },
  ];
  const current = {
    ...emptyLibrary(),
    sessions: [createSession(demo, "route-a")],
  };
  const before = structuredClone(current);
  for (const mutate of mutations) {
    const pack = structuredClone(demo);
    mutate(pack);
    assert.throws(
      () => mergeBackup(current, { ...emptyLibrary(), packs: [pack] }, [demo]),
      /攻略数据不完整/,
    );
    assert.deepEqual(current, before);
  }
});

test("unknown pack releases and routes cannot be replayed or silently imported as another version", () => {
  const session = createSession(demo, "route-a");
  const mutations = [
    { packId: "missing-pack" },
    { revision: 999 },
    { releaseId: "missing-release" },
    { routeId: "missing-route" },
  ];
  for (const mutation of mutations) {
    const invalid = { ...session, ...mutation };
    assert.throws(() => replay(demo, invalid));
    assert.throws(() =>
      validateBackup({ ...emptyLibrary(), sessions: [invalid] }, [demo]),
    );
  }
  assert.throws(() => createSession(demo, "missing-route"), /找不到/);
});

test("forged skips, nonexistent options, premature completion and events after an ending are rejected", () => {
  const original = createSession(demo, "route-a");
  const invalid = [
    { ...original, events: [event("missing-step", "library")] },
    { ...original, events: [event("choice-1", "missing-option")] },
    { ...original, events: [event("choice-1", "__skip__")] },
    { ...original, completed: true },
    {
      ...original,
      events: [event("choice-1", "garden"), event("choice-2", "stay")],
    },
  ];
  for (const session of invalid)
    assert.throws(() =>
      validateBackup({ ...emptyLibrary(), sessions: [session] }, [demo]),
    );
  const done = confirmEnding(demo, recordChoice(demo, original, "garden"));
  assert.throws(() => recordChoice(demo, done, "library"), /已结束/);
  assert.deepEqual(original.events, []);
});

test("a real step on another route is still rejected as a bookmark", () => {
  const incoming = {
    ...emptyLibrary(),
    bookmarks: [
      {
        packKey: packKey(demo),
        routeId: "route-b",
        choiceId: "choice-2",
        at: when,
      },
    ],
  };
  assert.throws(() => validateBackup(incoming, [demo]), /书签不属于/);
});

test("prototype properties are never treated as recorded choices, flags or counters", () => {
  const state = {
    choices: {},
    flags: {},
    counters: {},
    completedEndingIds: [],
  };
  assert.equal(
    evaluate({ choiceId: "constructor", optionId: "library" }, state),
    null,
  );
  assert.equal(evaluate({ flag: "constructor", equals: true }, state), null);
  assert.equal(evaluate({ counter: "constructor", atLeast: 0 }, state), null);
  assert.equal(Object.hasOwn(state.choices, "constructor"), false);
});
