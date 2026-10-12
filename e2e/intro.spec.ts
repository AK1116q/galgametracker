import { expect, test } from "@playwright/test";

test("entry rain has visible moving glyphs, clears itself and replays on refresh", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const rain = page.locator(".archive-glyph-rain");
  await expect(rain).toBeVisible();
  const frames = await rain.evaluate(async (node: HTMLCanvasElement) => {
    const ctx = node.getContext("2d")!;
    const sample = () => {
      const pixels = ctx.getImageData(0, 0, node.width, node.height).data;
      let count = 0;
      let fingerprint = 0;
      for (let i = 3; i < pixels.length; i += 68) {
        if (pixels[i] > 10) count++;
        fingerprint = (fingerprint + pixels[i] * i) % 2147483647;
      }
      return { count, fingerprint };
    };
    const before = sample();
    await new Promise((resolve) => setTimeout(resolve, 120));
    return { before, after: sample(), area: node.width * node.height };
  });
  expect(frames.before.count).toBeGreaterThan(100);
  expect(frames.after.fingerprint).not.toBe(frames.before.fingerprint);
  expect(frames.area).toBeLessThan(2_410_000);
  await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator(".disc-hit")).toBeVisible();
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(rain).toBeVisible();
  await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 4000 });
});

test("reduced motion opens directly without a rain canvas or input lock", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("开场动画")).toHaveCount(0);
  await expect(page.locator(".archive-glyph-rain")).toHaveCount(0);
  await expect(page.locator(".disc-hit")).toBeVisible();
  await expect(page.locator("main")).not.toHaveAttribute("inert");
});
