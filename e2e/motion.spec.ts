import { openCatalog } from "./catalog-helper";
import { test, expect } from "@playwright/test";

async function open(page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "跳过动画" }).click();
}

test("disc animation settles without idle writes or permanent GPU hints", async ({
  page,
}) => {
  await open(page);
  await page.locator(".disc-stage").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".disc-info h2")).toHaveText(
    "ATRI -My Dear Moments-",
  );
  await expect
    .poll(() =>
      page
        .locator(".optical-disc")
        .evaluateAll((els) =>
          els.every((el) => (el as HTMLElement).style.willChange === "auto"),
        ),
    )
    .toBe(true);
  const writes = await page.locator(".disc-scene").evaluate(
    (el) =>
      new Promise<number>((resolve) => {
        let count = 0;
        const observer = new MutationObserver(
          (records) => (count += records.length),
        );
        observer.observe(el, { attributes: true, subtree: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(count);
        }, 250);
      }),
  );
  expect(writes).toBe(0);
});

test("catalog closes with a transition and rapidly interrupted navigation reaches the last target", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  await openCatalog(page);
  await expect(page.locator(".catalog-panel")).toBeVisible();
  await page.waitForTimeout(260);
  const exit = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLDialogElement>(".catalog-panel")!;
    (dialog.querySelector("button") as HTMLButtonElement).click();
    return getComputedStyle(dialog).transitionProperty;
  });
  expect(exit).toContain("overlay");
  await expect(page.locator(".catalog-panel")).not.toBeVisible();
  await page.evaluate(() => {
    (
      document.querySelector('[data-view-link="records"]') as HTMLButtonElement
    ).click();
    (document.querySelector(".brand") as HTMLButtonElement).click();
  });
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-view",
    "library",
  );
  expect(errors).toEqual([]);
});

test("fallback navigation animates and reduced motion suppresses click animations", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(document, "startViewTransition", {
      value: undefined,
    }),
  );
  await open(page);
  await page.getByRole("button", { name: /查看攻略/ }).click();
  await page.getByRole("button", { name: "游玩记录", exact: true }).click();
  await page
    .getByRole("button", { name: "数据与设置", exact: true })
    .first()
    .click();
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-view",
    "settings",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: /^我的游戏库/ }).click();
  await expect(page.locator(".disc-stage")).toBeVisible();
  const active = await page.evaluate(
    () =>
      document.getAnimations().filter((a) => a.playState === "running").length,
  );
  expect(active).toBe(0);
});
