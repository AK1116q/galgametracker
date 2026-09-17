import test from "node:test";
import assert from "node:assert/strict";
import pack from "../data/wa2/setsuna-cc.route.json" with { type: "json" };
import {
  emptyLibrary,
  validateBackup,
  mergeBackup,
  packKey,
} from "../core/backup.mjs";

test("legacy backups remain readable and saved routes survive export/merge", () => {
  const old = emptyLibrary();
  assert.equal(validateBackup(old, [pack]), old);
  const item = {
    packKey: packKey(pack),
    routeId: pack.routes[0].id,
    at: "2026-09-18T00:00:00Z",
  };
  const incoming = { ...emptyLibrary(), favorites: [item], visits: [item] };
  const merged = mergeBackup(old, JSON.parse(JSON.stringify(incoming)), [pack]);
  assert.deepEqual(merged.favorites, [item]);
  assert.deepEqual(mergeBackup(merged, incoming, [pack]).visits, [item]);
  assert.throws(() =>
    validateBackup(
      { ...incoming, favorites: [{ ...item, routeId: "missing" }] },
      [pack],
    ),
  );
  assert.throws(() =>
    validateBackup({ ...incoming, favorites: [item, item] }, [pack]),
  );
});
