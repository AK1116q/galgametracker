import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const data = JSON.parse(
  readFileSync(new URL("../src/gallery-metadata.json", import.meta.url)),
);
test("gallery ratings are dated Bangumi records, not substituted VNDB ratings", () => {
  const catalogCount = readdirSync(new URL('../data/catalog/', import.meta.url)).filter((name) => name.endsWith('.route.json')).length;
  assert.equal(Object.keys(data).length, catalogCount + 1); // WA2 is stored separately
  for (const review of Object.values(data)) {
    assert.ok(review.score > 0 && review.score <= 10);
    assert.ok(Number.isInteger(review.votes) && review.votes > 0);
    assert.equal(review.url, `https://bgm.tv/subject/${review.subjectId}`);
    assert.ok(review.source.startsWith("https://api.bgm.tv/"));
    assert.match(review.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(review.comment.length > 10 && review.comment.length < 70);
  }
  assert.equal(data["white-album-2"].subjectId, 22290);
  assert.match(data["white-album-2"].scope, /CC/);
  assert.equal(data.aokana.subjectId, 76912); // game, not its TV adaptation
});
