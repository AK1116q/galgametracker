import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const demo = JSON.parse(readFileSync("data/examples/demo.route.json", "utf8"));
const coda = JSON.parse(
  readFileSync("data/wa2/kazusa-coda.route.json", "utf8"),
);
const atri = JSON.parse(readFileSync("data/catalog/atri.route.json", "utf8"));
const storageKey = "galgametracker.web.v1";
const seed = JSON.stringify({
  format: "galgametracker-backup",
  version: 1,
  packs: [],
  sessions: [],
  completed: [],
  favorites: [
    {
      packKey: `${coda.id}@${coda.revision}`,
      routeId: "kazusa-true",
      at: "2026-10-15T00:00:00.000Z",
    },
  ],
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: storageKey, value: seed },
  );
});

test("invalid public guide tuples show a recoverable empty state and preserve favorites", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const prefix = `/guides/${coda.game.id}/${coda.id}`;
  for (const path of [
    `${prefix}/999999/kazusa-true/`,
    `${prefix}/1/nonexistent-route/`,
    `/guides/missing-game/${coda.id}/1/kazusa-true/`,
    `/guides/${coda.game.id}/missing-pack/1/kazusa-true/`,
    `${prefix}/1/kazusa-true%2Funknown/`,
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "找不到这部作品", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".route-tree")).toHaveCount(0);
    await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
    await expect(page.locator(".disc-stage")).toBeVisible();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
    ).toBe(seed);
  }
  expect(errors).toEqual([]);
});

test("hostile query values are inert text and unknown views safely return to the library", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const payload =
    '<img id="injected" src=x onerror="globalThis.__urlExecuted=1">';
  await page.goto(`/?view=game&game=${encodeURIComponent(payload)}`);
  await expect(
    page.getByRole("heading", { name: "找不到这部作品", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#injected")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as Window & { __urlExecuted?: number }).__urlExecuted,
    ),
  ).toBeUndefined();
  await page.goto(
    `/?view=${encodeURIComponent("javascript:alert(1)")}&game=%E0%A4%A`,
  );
  await expect(page.locator(".disc-stage")).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(seed);
  expect(errors).toEqual([]);
});

test("an unavailable target revision does not silently select the latest guide", async ({
  page,
}) => {
  const target = `${coda.id}@999999/kazusa-true`;
  await page.goto(
    `/?view=game&game=white-album-2&chapter=coda&target=${encodeURIComponent(target)}`,
  );
  await expect(
    page.getByRole("heading", { name: "白色相簿2", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".route-tree")).toHaveCount(0);
  await expect(page.locator(".tracking-bar")).toHaveCount(0);
  await expect(
    page.getByText("此攻略版本或路线不可用，请重新选择目标结局。", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(seed);
  await page.getByRole("button", { name: /^冬马和纱 · True Ending/ }).click();
  await expect(page.locator(".tree-step").first()).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(
    `/guides/${coda.game.id}/${coda.id}/${coda.revision}/kazusa-true/`,
  );
});

test("an invalid chapter explains the broken link and allows selecting a real chapter", async ({
  page,
}) => {
  await page.goto("/?view=game&game=white-album-2&chapter=missing-chapter");
  await expect(
    page.getByText("链接中的篇章不存在，请重新选择篇章。", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".route-tree")).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(seed);
  await page.getByRole("button", { name: /^Coda · 最终章/ }).click();
  await expect(
    page.getByText("链接中的篇章不存在，请重新选择篇章。", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^冬马和纱 · True Ending/ }).click();
  await expect(page.locator(".tree-step").first()).toBeVisible();
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  );
  expect(stored.favorites).toEqual(JSON.parse(seed).favorites);
  expect(stored.sessions).toEqual([]);
  expect(stored.visits).toEqual([
    expect.objectContaining({
      packKey: `${coda.id}@${coda.revision}`,
      routeId: "kazusa-true",
    }),
  ]);
});

for (const { pack, routeId, wrongChapter, chapter } of [
  { pack: coda, routeId: "kazusa-true", wrongChapter: "ic", chapter: "coda" },
  { pack: atri, routeId: "good", wrongChapter: "coda", chapter: "other" },
]) {
  test(`valid ${pack.game.id} target corrects a conflicting chapter and keeps metadata consistent`, async ({
    page,
  }) => {
    const route = pack.routes.find(
      (item: { id: string }) => item.id === routeId,
    );
    const target = `${pack.id}@${pack.revision}/${routeId}`;
    await page.goto(
      `/?view=game&game=${pack.game.id}&chapter=${wrongChapter}&target=${encodeURIComponent(target)}`,
    );
    await expect(page.locator(".route-tree")).toBeVisible();
    await expect(page.locator(".turntable")).toHaveAttribute(
      "data-chapter",
      chapter,
    );
    await expect(page.locator(".guide-title")).toContainText(route.safeLabel);
    await expect(page).toHaveTitle(
      `${pack.game.title} · ${route.safeLabel}攻略`,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://galgametracker.pages.dev/guides/${pack.game.id}/${pack.id}/${pack.revision}/${routeId}/`,
    );
    expect(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
    ).toBe(seed);
    await page.reload();
    await expect(page.locator(".route-tree")).toBeVisible();
    await expect(page.locator(".turntable")).toHaveAttribute(
      "data-chapter",
      chapter,
    );
  });
}

test("invalid imported conditions and missing steps leave existing saved data untouched", async ({
  page,
}) => {
  await page.goto("/?view=settings");
  const invalidCondition = structuredClone(demo);
  invalidCondition.choices[0].rules[0].when = { any: [] };
  const missingStep = structuredClone(demo);
  missingStep.choices[0].skipTo = { kind: "choice", id: "missing-step" };
  const invalidSource = structuredClone(demo);
  invalidSource.sources[0].reference = "https://%";
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  for (const pack of [invalidCondition, missingStep, invalidSource]) {
    await page.getByLabel("导入数据文件").setInputFiles({
      name: "invalid-route.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(pack)),
    });
    await expect(page.getByRole("status")).toContainText(
      "无法导入：攻略数据不完整",
    );
    expect(
      await page.evaluate((key) => localStorage.getItem(key), storageKey),
    ).toBe(seed);
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "数据与设置", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(seed);
  expect(pageErrors).toEqual([]);
});
