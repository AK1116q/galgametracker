import { test, expect } from "@playwright/test";

test("keyboard focus survives scroll-induced hover until mouse input resumes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "作品目录", exact: true }).click();
  const rows = page
    .getByRole("dialog")
    .getByRole("button", { name: /^选择作品：/ });
  await rows.nth(1).hover();
  await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
  await rows.last().focus();
  await expect(rows.last()).toHaveAttribute("aria-current", "true");
  // Native focus scrolling can put a different row below the stationary mouse.
  await rows.nth(12).dispatchEvent("pointerover", { pointerType: "mouse" });
  await page.waitForTimeout(180);
  await expect(rows.last()).toHaveAttribute("aria-current", "true");
  await rows.nth(12).dispatchEvent("pointermove", {
    pointerType: "mouse",
    movementY: 4,
  });
  await expect(rows.nth(12)).toHaveAttribute("aria-current", "true");
  await rows.nth(14).focus();
  await rows.last().focus();
  await expect(rows.last()).toHaveAttribute("aria-current", "true");
  await rows.nth(10).dispatchEvent("wheel", { deltaY: 30 });
  await rows.nth(10).dispatchEvent("pointerover", { pointerType: "mouse" });
  await expect(rows.nth(10)).toHaveAttribute("aria-current", "true");
});

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

test("hovering across catalog pages uses the full disc flip and lands on the hovered work", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "作品目录", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "作品目录", exact: true });
  const last = panel.getByRole("button", { name: /^选择作品：/ }).last();
  const title = await last.locator("strong").innerText();
  await last.hover();
  const shelf = page.locator(".disc-library");
  await expect(shelf).toHaveAttribute("data-flight", "out");
  const departing = await page.locator(".disc-hit").evaluate((el) =>
    el.getAnimations().some((animation) => {
      const effect = animation.effect as KeyframeEffect;
      return effect
        .getKeyframes()
        .some((frame) =>
          String(frame.transform).includes("rotateY(90deg) scale(1.45)"),
        );
    }),
  );
  expect(departing).toBe(true);
  await expect(shelf).toHaveAttribute("data-flight", "in");
  await expect(shelf).toHaveAttribute("data-page", "2");
  await expect(page.locator(".disc-hit .disc-print strong")).toHaveText(title);
  const arriving = await page.locator(".disc-hit").evaluate((el) =>
    el.getAnimations().some((animation) => {
      const effect = animation.effect as KeyframeEffect;
      return effect
        .getKeyframes()
        .some((frame) =>
          String(frame.transform).includes("rotateY(-90deg) scale(1.45)"),
        );
    }),
  );
  expect(arriving).toBe(true);
  await expect(shelf).toHaveAttribute("data-flight", "idle");
  await expect(last).toHaveAttribute("aria-current", "true");
  expect(
    await page
      .locator(".optical-disc")
      .evaluateAll(
        (elements) => elements.flatMap((el) => el.getAnimations()).length,
      ),
  ).toBe(0);

  const first = panel.getByRole("button", {
    name: "选择作品：白色相簿2",
    exact: true,
  });
  await first.hover();
  await expect(shelf).toHaveAttribute("data-flight", "out");
  await expect(shelf).toHaveAttribute("data-flight", "idle");
  await expect(shelf).toHaveAttribute("data-page", "1");
  await expect(page.locator(".disc-hit .disc-face")).toHaveAttribute(
    "data-game-id",
    "white-album-2",
  );
});

test("a newer hover replaces the pending page destination instead of queuing stale rows", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.getByRole("button", { name: "作品目录", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "作品目录", exact: true });
  const rows = panel.getByRole("button", { name: /^选择作品：/ });
  await rows.last().focus();
  const shelf = page.locator(".disc-library");
  await expect(shelf).toHaveAttribute("data-flight", "out");
  await rows.nth(10).focus();
  const atri = panel.getByRole("button", {
    name: "选择作品：ATRI -My Dear Moments-",
    exact: true,
  });
  await atri.focus();
  // Closing during the outgoing flip must preserve the last hover target.
  await page.keyboard.press("Escape");
  await expect(shelf).toHaveAttribute("data-flight", "idle");
  await expect(shelf).toHaveAttribute("data-page", "1");
  await expect(page.locator(".disc-hit .disc-face")).toHaveAttribute(
    "data-game-id",
    "atri",
  );
  await page.locator(".disc-stage").press("Enter");
  await expect(page.locator(".game-workspace h1")).toHaveText(
    "ATRI -My Dear Moments-",
  );
  expect(errors).toEqual([]);
});
