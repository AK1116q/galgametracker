import test from "node:test";
import assert from "node:assert/strict";
import { reviewInfo, findGuideNodes } from "../core/guide-info.mjs";
import pack from "../data/wa2/kazusa-coda.route.json" with { type: "json" };
import { guidePath } from "../core/guide.mjs";

test("review labels require explicit route coverage, not links or verified flag alone", () => {
  assert.equal(
    reviewInfo(pack, "kazusa-true").label,
    "多来源交叉核对 · 未实机",
  );
  const p = structuredClone(pack);
  p.status = "verified";
  assert.notEqual(reviewInfo(p).label, "实机验证");
  p.reviews[0].method = "playtest";
  assert.equal(reviewInfo(p).label, "实机验证");
  p.reviews[0].routeIds = [];
  assert.equal(reviewInfo(p).label, "多来源整理 · 待交叉核对");
  p.sources = p.sources.slice(0, 1);
  assert.equal(reviewInfo(p).label, "单来源整理 · 未实机");
  p.status = "withdrawn";
  assert.equal(reviewInfo(p).label, "已撤回");
});

test("locator search handles dates, spaces, full-width input and alternative options", () => {
  const nodes = guidePath(pack, "kazusa-true").nodes;
  assert.equal(findGuideNodes(nodes, "１２／２４")[0].id, "coda-01");
  assert.equal(findGuideNodes(nodes, "12 月 24 日")[0].id, "coda-01");
  assert.equal(findGuideNodes(nodes, "近期准备求婚")[0].id, "coda-01");
  assert.equal(findGuideNodes(nodes, "12/31")[0].id, "coda-02");
  assert.deepEqual(findGuideNodes(nodes, "不存在的选项"), []);
  assert.deepEqual(findGuideNodes(nodes, "  "), []);
});
