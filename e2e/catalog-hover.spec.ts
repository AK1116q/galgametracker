import { test, expect } from "@playwright/test";

test("bottom catalog previews hovered and focused works across pages without opening a guide", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "作品目录", exact: true });
  const box = await trigger.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeLessThan(viewport.width / 3);
  expect(box!.y).toBeGreaterThan(viewport.height * 0.8);
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "作品目录", exact: true });
  const panelBox = await panel.boundingBox();
  expect(panelBox!.y + panelBox!.height).toBeLessThan(box!.y);
  const first = panel.getByRole("button", {
    name: "选择作品：ATRI -My Dear Moments-",
    exact: true,
  });
  await first.hover();
  await expect(page.locator(".disc-hit .disc-face")).toHaveAttribute(
    "data-game-id",
    "atri",
  );
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-view",
    "library",
  );
  const last = panel.getByRole("button", { name: /^选择作品：/ }).last();
  await last.focus();
  await expect(page.locator(".disc-library")).toHaveAttribute("data-page", "2");
  await expect(last).toHaveAttribute("aria-current", "true");
  await first.focus();
  await expect(page.locator(".disc-library")).toHaveAttribute("data-page", "1");
  await expect(page.locator(".disc-hit .disc-face")).toHaveAttribute(
    "data-game-id",
    "atri",
  );
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.locator(".disc-stage").press("Enter");
  await expect(page.locator(".game-workspace h1")).toHaveText(
    "ATRI -My Dear Moments-",
  );
});

test("closing a preview does not pull the shelf back after an animated page change", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "作品目录", exact: true }).click();
  await page
    .getByRole("button", {
      name: "选择作品：ATRI -My Dear Moments-",
      exact: true,
    })
    .focus();
  await expect(page.locator(".disc-hit .disc-face")).toHaveAttribute(
    "data-game-id",
    "atri",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "第 2 页作品", exact: true }).click();
  const shelf = page.locator(".disc-library");
  await expect(shelf).toHaveAttribute("data-flight", "out");
  await expect(shelf).toHaveAttribute("data-page", "2");
  await expect(shelf).toHaveAttribute("data-flight", "idle");
  await expect(page.locator(".disc-hit .disc-face")).not.toHaveAttribute(
    "data-game-id",
    "atri",
  );
  await expect(shelf).toHaveAttribute("data-page", "2");
});
