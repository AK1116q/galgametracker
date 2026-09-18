import test from "node:test";
import assert from "node:assert/strict";
import pack from "../data/wa2/kazusa-coda.route.json" with { type: "json" };
import { routeIssues, stepSources, editorial } from "../core/evidence.mjs";
test("supplemental evidence is revision-bound and does not resolve unverified disputes", () => {
  assert.equal(
    routeIssues(pack, "kazusa-true", "coda-02")[0].id,
    "wa2-coda-date",
  );
  assert.equal(
    routeIssues(pack, "kazusa-true", "coda-10")[0].id,
    "wa2-coda-wording",
  );
  assert.deepEqual(routeIssues({ ...pack, revision: 2 }, "kazusa-true"), []);
  assert.deepEqual(routeIssues(pack, "missing"), []);
  assert.equal(
    stepSources(pack, "kazusa-true", "coda-10")[0].source.id,
    "seiya",
  );
  for (const issue of editorial.issues) {
    assert.equal(issue.status, "open");
    for (const id of issue.choiceIds)
      assert.ok(pack.choices.some((c) => c.id === id));
    for (const e of issue.evidence)
      assert.equal(new URL(e.url).protocol, "https:");
  }
});
