import { test, expect, type Page } from "@playwright/test";

async function openWithoutIntro(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".disc-hit")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
}

async function settled(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-page-transition",
    /.+/,
  );
  await expect(
    page.locator('[style*="view-transition-name: travelling-disc"]'),
  ).toHaveCount(0);
  await expect(page.locator(".disc-transfer-fallback")).toHaveCount(0);
}

test("selected disc visibly travels to the turntable and back, then releases snapshots", async ({
  page,
}) => {
  await openWithoutIntro(page);
  await page.evaluate(() => {
    const record = (window as Window & { transitionRecord?: { states: string[]; transforms: string[] } }).transitionRecord = {
      states: [], transforms: [],
    };
    const observe = new MutationObserver(() => {
      const state = document.documentElement.dataset.pageTransition;
      if (state) record.states.push(state);
    });
    observe.observe(document.documentElement, { attributes: true, attributeFilter: ["data-page-transition"] });
    const sample = () => {
      const transform = getComputedStyle(document.documentElement, "::view-transition-group(travelling-disc)").transform;
      if (transform && transform !== "none") record.transforms.push(transform);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.locator(".disc-stage").press("Enter");
  await expect(page.locator(".turntable")).toBeVisible();
  await settled(page);
  const outbound = await page.evaluate(() => (window as Window & { transitionRecord?: { states: string[]; transforms: string[] } }).transitionRecord!);
  expect(outbound.states).toContain("disc");
  expect(new Set(outbound.transforms).size).toBeGreaterThan(1);
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await expect(page.locator(".disc-stage")).toBeVisible();
  await settled(page);
  const roundtrip = await page.evaluate(() => (window as Window & { transitionRecord?: { states: string[]; transforms: string[] } }).transitionRecord!);
  expect(roundtrip.states.filter((state) => state === "disc").length).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".disc-info h2")).toHaveText("白色相簿2");
});

test("rapid return interrupts the flight without leaving a hidden disc or blocked controls", async ({
  page,
}) => {
  await openWithoutIntro(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.locator(".disc-stage").press("Enter");
  await page
    .locator(".back-link")
    .evaluate((el: HTMLButtonElement) => el.click());
  await expect(page.locator(".disc-stage")).toBeVisible();
  await settled(page);
  await page.locator(".disc-stage").press("ArrowRight");
  await expect(page.locator(".disc-info h2")).toHaveText(
    "ATRI -My Dear Moments-",
  );
  expect(errors).toEqual([]);
});

test("browsers without View Transitions animate a disc overlay and clean it up", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "startViewTransition", {
      value: undefined,
      configurable: true,
    });
  });
  await openWithoutIntro(page);
  await page.evaluate(() => {
    const original = Element.prototype.animate;
    (window as Window & { transferFrames?: string[] }).transferFrames = [];
    Element.prototype.animate = function (frames, options) {
      if (this.classList.contains("disc-transfer-fallback"))
        (window as Window & { transferFrames?: string[] }).transferFrames!.push(
          JSON.stringify(frames),
        );
      return original.call(this, frames, options);
    };
  });
  await page.locator(".disc-stage").press("Enter");
  await expect
    .poll(() => page.evaluate(() => (window as Window & { transferFrames?: string[] }).transferFrames?.length ?? 0))
    .toBeGreaterThan(0);
  const frames = await page.evaluate(() => (window as Window & { transferFrames?: string[] }).transferFrames ?? []);
  expect(frames[0]).toContain("translate(0, 0) scale(1)");
  expect(JSON.parse(frames[0])[1].transform).not.toBe("translate(0, 0) scale(1)");
  await settled(page);
  await expect(page.locator(".turntable__platter .disc-face")).toBeVisible();
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as Window & { transferFrames?: string[] }).transferFrames?.length ?? 0))
    .toBeGreaterThan(1);
  await settled(page);
  await expect(page.locator(".disc-hit .disc-face")).toBeVisible();
});

test("reduced motion navigates immediately and never mounts a transfer layer", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".disc-stage").press("Enter");
  await expect(page.locator(".turntable")).toBeVisible();
  await settled(page);
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await expect(page.locator(".disc-stage")).toBeVisible();
  await settled(page);
});
