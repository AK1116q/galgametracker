import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validatePack } from "../scripts/validate-data.mjs";

const sample = JSON.parse(
  readFileSync(
    new URL("../data/examples/demo.route.json", import.meta.url),
    "utf8",
  ),
);

test("synthetic multi-route example conforms to the contract", () => {
  assert.deepEqual(validatePack(sample), []);
});

const badCases = [
  [
    "missing release",
    (p) => {
      delete p.release;
    },
    /required/,
  ],
  [
    "empty display text",
    (p) => {
      p.choices[0].prompt = " ";
    },
    /pattern/,
  ],
  [
    "duplicate choice IDs",
    (p) => {
      p.choices.push(structuredClone(p.choices[0]));
    },
    /duplicate id/,
  ],
  [
    "duplicate option IDs",
    (p) => {
      p.choices[0].options[1].id = "library";
    },
    /duplicate id/,
  ],
  [
    "dangling destination",
    (p) => {
      p.choices[0].options[0].next.id = "missing";
    },
    /option destination/,
  ],
  [
    "recommendation from another node",
    (p) => {
      p.choices[0].rules[0].recommendedOptionIds = ["stay"];
    },
    /recommended option/,
  ],
  [
    "missing source",
    (p) => {
      p.choices[0].rules[0].sourceId = "missing";
    },
    /rule source/,
  ],
  [
    "missing prerequisite",
    (p) => {
      p.routes[0].requiredEndingIds = ["missing"];
    },
    /route prerequisite/,
  ],
  [
    "invalid nested condition",
    (p) => {
      p.choices[0].rules[0].when = {
        all: [{ any: [{ choiceId: "choice-2", optionId: "library" }] }],
      };
    },
    /condition option/,
  ],
  [
    "synthetic publish",
    (p) => {
      p.status = "verified";
    },
    /synthetic pack/,
  ],
  [
    "synthetic source disguised as real",
    (p) => {
      p.synthetic = false;
    },
    /synthetic sources/,
  ],
  [
    "review references absent route",
    (p) => {
      p.reviews = [
        {
          reviewer: "tester",
          date: "2026-09-14",
          routeIds: ["missing"],
          evidence: "test",
        },
      ];
    },
    /review route/,
  ],
  [
    "invalid review date",
    (p) => {
      p.reviews = [
        {
          reviewer: "tester",
          date: "2026-02-30",
          routeIds: ["route-a"],
          evidence: "test",
        },
      ];
    },
    /invalid date/,
  ],
];
for (const [label, mutate, expected] of badCases) {
  test(`rejects ${label}`, () => {
    const pack = structuredClone(sample);
    mutate(pack);
    assert.match(validatePack(pack).join("\n"), expected);
  });
}

test("verified status requires evidence covering every route (structural check only)", () => {
  const pack = structuredClone(sample);
  pack.synthetic = false;
  pack.sources[0].kind = "own_notes";
  pack.status = "verified";
  assert.match(validatePack(pack).join("\n"), /requires review/);
  pack.reviews = [
    {
      reviewer: "test-only",
      date: "2026-09-14",
      routeIds: ["route-a"],
      evidence: "unit test; not real verification",
    },
  ];
  assert.match(validatePack(pack).join("\n"), /route-b/);
  pack.reviews[0].routeIds.push("route-b");
  assert.deepEqual(validatePack(pack), []);
});
