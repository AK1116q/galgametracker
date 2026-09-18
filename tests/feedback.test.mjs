import test from "node:test";
import assert from "node:assert/strict";
import pack from "../data/wa2/kazusa-coda.route.json" with { type: "json" };
import { guideFeedbackUrl } from "../core/feedback.mjs";

test("feedback drafts carry route revision and selected step without player data", () => {
  const data = {
    ...pack,
    sessions: [{ id: "PRIVATE-SESSION" }],
    email: "PRIVATE-EMAIL",
  };
  const url = new URL(guideFeedbackUrl(data, "kazusa-true", "coda-02"));
  assert.equal(
    url.origin + url.pathname,
    "https://github.com/AK1116q/galgametracker/issues/new",
  );
  const body = url.searchParams.get("body");
  assert.match(body, /wa2-pc-coda-kazusa · revision 1/);
  assert.match(body, /步骤 ID：coda-02/);
  assert.match(body, /12月28日 \/ 31日/);
  assert.match(body, /目标：冬马和纱/);
  assert.doesNotMatch(body, /PRIVATE-/);
  assert.doesNotMatch(url.searchParams.get("title"), /冬马|True Ending/);
  const link = new URL(body.match(/攻略链接：(.*)/)[1]);
  assert.equal(
    link.searchParams.get("target"),
    "wa2-pc-coda-kazusa@1/kazusa-true",
  );
  assert.equal(link.searchParams.has("session"), false);
  assert.match(
    new URL(guideFeedbackUrl(pack, "kazusa-true")).searchParams.get("body"),
    /范围：整条路线/,
  );
  assert.throws(() => guideFeedbackUrl(pack, "missing"));
  assert.throws(() => guideFeedbackUrl(pack, "kazusa-true", "missing"));
});
