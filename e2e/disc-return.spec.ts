import { test, expect, type Page } from "@playwright/test";

type TransferEvidence = {
  kind?: string;
  from?: string;
  to?: string;
  transform: string;
  mounted?: boolean;
  moving?: boolean;
};
type InstrumentedWindow = Window & {
  __discTransfers: TransferEvidence[];
};

async function observeTransfers(page: Page, fallback: boolean) {
  await page.addInitScript((fallback) => {
    const records: TransferEvidence[] = [];
    (window as InstrumentedWindow).__discTransfers = records;
    if (fallback) {
      Object.defineProperty(document, "startViewTransition", {
        value: undefined,
        configurable: true,
      });
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (keyframes, options) {
        const animation = animate.call(this, keyframes, options);
        if (this.classList.contains("disc-transfer-fallback")) {
          const frames = (animation.effect as KeyframeEffect).getKeyframes();
          const target = document.querySelector(
            ".disc-hit > .disc-face, .turntable__platter > .disc-face",
          );
          records.push({
            kind: document.documentElement.dataset.pageTransition,
            from:
              this.querySelector(".disc-print strong")?.textContent ||
              undefined,
            to:
              target?.querySelector(".disc-print strong")?.textContent ||
              undefined,
            transform: String(frames.at(-1)?.transform || ""),
            mounted: this.isConnected,
            moving:
              frames.length > 1 &&
              frames[0].transform !== frames.at(-1)?.transform,
          });
        }
        return animation;
      };
      return;
    }
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = (update) => {
      const sharedDisc = () =>
        document.querySelector<HTMLElement>(
          '[style*="view-transition-name: travelling-disc"]',
        );
      const from = sharedDisc()?.dataset.gameId;
      const transition = start(update);
      // Capture during readiness instead of racing a short-lived animation with
      // several browser round trips on a busy CI worker.
      void transition.ready.then(
        () => {
          records.push({
            kind: document.documentElement.dataset.pageTransition,
            from,
            to: sharedDisc()?.dataset.gameId,
            transform: getComputedStyle(
              document.documentElement,
              "::view-transition-group(travelling-disc)",
            ).transform,
          });
        },
        () => {},
      );
      return transition;
    };
  }, fallback);
}

test("a direct ATRI guide link returns to its own disc and survives browser forward", async ({
  page,
}) => {
  await observeTransfers(page, false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const path = "/guides/atri/atri-pc/1/good/";
  await page.goto(path);
  await expect(
    page.locator(".turntable__platter > .disc-face"),
  ).toHaveAttribute("data-game-id", "atri");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await travelling(page, false);
  await expect(page.locator(".disc-hit > .disc-face")).toHaveAttribute(
    "data-game-id",
    "atri",
  );
  await page.goBack();
  await travelling(page, false);
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(
    page.locator(".turntable__platter > .disc-face"),
  ).toHaveAttribute("data-game-id", "atri");
  await page.goForward();
  await travelling(page, false);
  await expect(page.locator(".disc-info h2")).toHaveText(
    "ATRI -My Dear Moments-",
  );
  await expect(page.locator(".disc-hit > .disc-face")).toBeVisible();
});

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

async function travelling(page: Page, fallback: boolean) {
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as InstrumentedWindow).__discTransfers.length,
      ),
    )
    .toBeGreaterThan(0);
  const record = await page.evaluate(() =>
    (window as InstrumentedWindow).__discTransfers.shift()!,
  );
  expect(record.kind).toBe("disc");
  expect(record.from).toBeTruthy();
  expect(record.to).toBe(record.from);
  expect(record.transform).not.toBe("none");
  expect(record.transform).not.toBe("");
  if (fallback) {
    expect(record.mounted).toBe(true);
    expect(record.moving).toBe(true);
  }
  await settled(page);
}

for (const fallback of [false, true]) {
  for (const work of ["ATRI", "second-page", "last-page"] as const) {
    test(`${fallback ? "fallback" : "native"}: ${work} keeps its disc and animation on button return and browser back/forward`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await observeTransfers(page, fallback);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await page.getByRole("button", { name: "作品目录", exact: true }).click();
      const rows = page
        .getByRole("dialog", { name: "作品目录", exact: true })
        .getByRole("button", { name: /^选择作品：/ });
      const row =
        work === "ATRI"
          ? rows.filter({ hasText: "ATRI -My Dear Moments-" })
          : work === "second-page"
            ? rows.nth(8)
            : rows.last();
      const title = await row.locator("strong").innerText();
      await row.focus();
      await expect(row).toHaveAttribute("aria-current", "true");
      const expectedPage =
        work === "ATRI"
          ? "1"
          : work === "second-page"
            ? "2"
            : String(Math.ceil((await rows.count()) / 8));
      await expect(page.locator(".disc-library")).toHaveAttribute(
        "data-page",
        expectedPage,
      );
      const gameId = await page
        .locator(".disc-hit > .disc-face")
        .getAttribute("data-game-id");
      expect(gameId).toBeTruthy();
      await page.keyboard.press("Escape");
      await page.emulateMedia({ reducedMotion: "no-preference" });

      await test.step("selected work opens with a shared disc", async () => {
        await page.locator(".disc-stage").press("Enter");
        await expect(page.locator(".game-workspace h1")).toHaveText(title);
        await travelling(page, fallback);
      });
      await test.step("browser back restores the original home entry and forward restores the detail", async () => {
        await page.goBack();
        await travelling(page, fallback);
        await expect(page.locator(".disc-hit > .disc-face")).toHaveAttribute(
          "data-game-id",
          gameId!,
        );
        await expect(page.locator(".disc-library")).toHaveAttribute(
          "data-page",
          expectedPage,
        );
        await expect(page).toHaveURL(/\/$/);
        await page.goForward();
        await travelling(page, fallback);
        await expect(
          page.locator(".turntable__platter > .disc-face"),
        ).toHaveAttribute("data-game-id", gameId!);
      });
      await test.step("page return button animates the same disc", async () => {
        await page
          .getByRole("button", { name: "返回游戏库", exact: true })
          .click();
        await travelling(page, fallback);
        await expect(page.locator(".disc-hit > .disc-face")).toHaveAttribute(
          "data-game-id",
          gameId!,
        );
        await expect(page.locator(".disc-library")).toHaveAttribute(
          "data-page",
          expectedPage,
        );
        await expect(page.locator(".disc-info h2")).toHaveText(title);
      });
      await test.step("browser back and forward also preserve the new home entry", async () => {
        await page.goBack();
        await travelling(page, fallback);
        await expect(
          page.locator(".turntable__platter > .disc-face"),
        ).toHaveAttribute("data-game-id", gameId!);
        await expect(page.locator(".game-workspace h1")).toHaveText(title);
        await page.goForward();
        await travelling(page, fallback);
        await expect(page.locator(".disc-hit > .disc-face")).toHaveAttribute(
          "data-game-id",
          gameId!,
        );
        await expect(page.locator(".disc-library")).toHaveAttribute(
          "data-page",
          expectedPage,
        );
        await expect(page.locator(".disc-info h2")).toHaveText(title);
        await expect(page.locator(".disc-hit > .disc-face")).toBeVisible();
      });
      expect(errors).toEqual([]);
    });
  }
}
