import test from "node:test";
import assert from "node:assert/strict";
import pack from "../data/wa2/kazusa-coda.route.json" with { type: "json" };
import { routeFromPath, routePathname, chapterFor } from "../core/urls.mjs";
test("public route URLs round-trip without exposing sessions or selecting unknown revisions", () => {
  const path = routePathname(pack, "kazusa-true");
  const found = routeFromPath(path, [pack]);
  assert.equal(found.pack.id, pack.id);
  assert.equal(found.route.id, "kazusa-true");
  assert.equal(chapterFor(found.pack), "coda");
  assert.equal(routeFromPath(path.replace("/1/", "/99/"), [pack]), undefined);
  assert.equal(routeFromPath("/guides/%xx/bad/1/route/", [pack]), undefined);
  assert.equal(routeFromPath(path, [{ ...pack, synthetic: true }]), undefined);
  assert.equal(path.includes("?"), false);
});
