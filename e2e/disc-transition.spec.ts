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
  await page.locator(".disc-stage").press("Enter");
  await expect(page.locator(".turntable")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-page-transition",
    "disc",
  );
  const transform = () =>
    page.evaluate(
      () =>
        getComputedStyle(
          document.documentElement,
          "::view-transition-group(travelling-disc)",
        ).transform,
    );
  await expect.poll(transform).not.toBe("none");
  const first = await transform();
  await expect.poll(transform).not.toBe(first);
  await settled(page);
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await expect(page.locator(".disc-stage")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-page-transition",
    "disc",
  );
  await settled(page);
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
  await page.locator(".disc-stage").press("Enter");
  const overlay = page.locator(".disc-transfer-fallback");
  await expect(overlay).toBeVisible();
  const first = await overlay.evaluate((el) => getComputedStyle(el).transform);
  await expect
    .poll(() => overlay.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe(first);
  await settled(page);
  await expect(page.locator(".turntable__platter .disc-face")).toBeVisible();
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await expect(overlay).toBeVisible();
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
