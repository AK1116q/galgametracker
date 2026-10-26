import { expect, test, type Page } from "@playwright/test";

test.afterEach(async ({ page }) => {
  expect((await page.pageErrors()).map((error) => error.message)).toEqual([]);
});

async function openShelf(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "no-preference" });
}
async function shelfReady(page: Page) {
  await expect(page.locator(".disc-library")).toHaveAttribute(
    "data-flight",
    "idle",
  );
  await expect(page.locator(".disc-scene")).not.toHaveAttribute("inert");
  await expect(page.locator("main")).not.toHaveAttribute("inert");
}
async function restoreHistory(page: Page, url: string) {
  await page.evaluate((url) => {
    history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, url);
}

test("a stalled cover cannot hold the entrance or block the next work", async ({
  page,
}) => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/images/discs/white-album-2.webp", async (route) => {
    await blocked;
    await route.abort();
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 4000 });
    await page.locator(".disc-stage").press("ArrowRight");
    await expect(page.locator(".disc-info h2")).toHaveText(
      "ATRI -My Dear Moments-",
    );
    await shelfReady(page);
  } finally {
    release();
  }
});

test("failed cover requests still allow pagination, guide opening and returning", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/images/**", (route) => route.abort());
  await openShelf(page);
  await page.getByRole("button", { name: "第 2 页作品", exact: true }).click();
  await shelfReady(page);
  await expect(page.locator(".disc-library")).toHaveAttribute("data-page", "2");
  await page.locator(".disc-stage").press("Enter");
  await expect(page.locator(".game-workspace h1")).toBeVisible();
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await shelfReady(page);
  expect(errors).toEqual([]);
});

test("cancelling the entrance spin releases the overlay and all input locks", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.locator('.archive-intro[data-phase="spinning"]'),
  ).toBeVisible();
  await page.evaluate(() =>
    document
      .getAnimations()
      .find((animation) => animation.id === "archive-spin")!
      .cancel(),
  );
  await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await page.locator(".disc-stage").press("ArrowRight");
  await expect(page.locator(".disc-info h2")).toHaveText(
    "ATRI -My Dear Moments-",
  );
});

test("enabling reduced motion during entrance and a flip stops motion without losing navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.locator('.archive-intro[data-phase="spinning"]'),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByLabel("开场动画")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "第 2 页作品", exact: true }).click();
  await expect(page.locator(".disc-library")).toHaveAttribute(
    "data-flight",
    "out",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(
      () =>
        page
          .locator(".optical-disc")
          .evaluateAll(
            (elements) =>
              elements
                .flatMap((element) => element.getAnimations())
                .filter((animation) => animation.playState === "running")
                .length,
          ),
      { timeout: 600 },
    )
    .toBe(0);
  await shelfReady(page);
  await expect(page.locator(".disc-library")).toHaveAttribute("data-page", "2");
  await page.locator(".disc-stage").press("PageUp");
  await expect(page.locator(".disc-library")).toHaveAttribute("data-page", "1");
});

test("cancelled outgoing and incoming page animations still settle the selected page", async ({
  page,
}) => {
  await openShelf(page);
  const cancellations = await page.evaluateHandle(() => {
    const original = Element.prototype.animate;
    const records: {
      phase: string;
      before: AnimationPlayState;
      after: AnimationPlayState;
      rejected: boolean;
    }[] = [];
    Element.prototype.animate = function (keyframes, options) {
      const animation = original.call(this, keyframes, options);
      const phase = this.closest<HTMLElement>(".disc-library")?.dataset.flight;
      if (
        this.matches(".optical-disc") &&
        (phase === "out" || phase === "in")
      ) {
        const record = {
          phase,
          before: animation.playState,
          after: animation.playState,
          rejected: false,
        };
        records.push(record);
        void animation.finished.catch(() => {
          record.rejected = true;
        });
        // Cancel the real animation immediately after its caller has attached
        // completion handlers. Browser round trips can otherwise miss "out"
        // and accidentally cancel "in" before the test even observes it.
        queueMicrotask(() => {
          record.before = animation.playState;
          animation.cancel();
          record.after = animation.playState;
        });
      }
      return animation;
    };
    return {
      records,
      restore: () => {
        Element.prototype.animate = original;
      },
    };
  });
  await page.getByRole("button", { name: "第 2 页作品", exact: true }).click();
  const shelf = page.locator(".disc-library");
  await shelfReady(page);
  await expect(shelf).toHaveAttribute("data-page", "2");
  const records = await cancellations.evaluate((instrumentation) => {
    instrumentation.restore();
    return instrumentation.records;
  });
  expect([...new Set(records.map((record) => record.phase))]).toEqual([
    "out",
    "in",
  ]);
  for (const record of records) {
    expect(record.before).toBe("running");
    expect(record.after).toBe("idle");
    expect(record.rejected).toBe(true);
  }
  await cancellations.dispose();
  await page.locator(".disc-stage").press("PageUp");
  await shelfReady(page);
  await expect(shelf).toHaveAttribute("data-page", "1");
});

test("leaving during a blocked catalog preview prevents a stale flip after return", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openShelf(page);
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/images/**", async (route) => {
    await blocked;
    await route.abort();
  });
  try {
    await page.getByRole("button", { name: "作品目录", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^选择作品：/ })
      .last()
      .focus();
    await expect(page.locator(".disc-library")).toHaveAttribute(
      "data-flight",
      "out",
    );
    await restoreHistory(page, "/?view=settings");
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-view",
      "settings",
    );
    release();
    await page.getByRole("button", { name: /^我的游戏库/ }).click();
    await shelfReady(page);
    await page.locator(".disc-stage").press("ArrowRight");
    await expect(page.locator(".disc-info h2")).toHaveText(
      "ATRI -My Dear Moments-",
    );
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});

test("a cancelled fallback flight restores the real disc and permits further navigation", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(document, "startViewTransition", {
      value: undefined,
      configurable: true,
    }),
  );
  await openShelf(page);
  await page.locator(".disc-stage").press("Enter");
  const overlay = page.locator(".disc-transfer-fallback");
  await expect(overlay).toBeVisible();
  await overlay.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.cancel()),
  );
  await expect(overlay).toHaveCount(0);
  await expect(page.locator(".turntable__platter .disc-face")).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-page-transition",
    /.+/,
  );
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await expect(overlay).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(overlay).toHaveCount(0);
  await shelfReady(page);
});

test("history navigation away from a paused entrance releases the destination immediately", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.locator('.archive-intro[data-phase="spinning"]'),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await restoreHistory(page, "/?view=settings");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-view",
    "settings",
  );
  await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 1000 });
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: /^我的游戏库/ }).click();
  await shelfReady(page);
});

test("backgrounding during a stalled page preload finishes the pending page without a lock", async ({
  page,
}) => {
  await openShelf(page);
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/images/**", async (route) => {
    await blocked;
    await route.abort();
  });
  try {
    await page
      .getByRole("button", { name: "第 2 页作品", exact: true })
      .click();
    await expect(page.locator(".disc-library")).toHaveAttribute(
      "data-flight",
      "out",
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator(".disc-library")).toHaveAttribute(
      "data-flight",
      "idle",
      { timeout: 800 },
    );
    await expect(page.locator(".disc-library")).toHaveAttribute(
      "data-page",
      "2",
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    release();
    await page.locator(".disc-stage").press("PageUp");
    await shelfReady(page);
    await expect(page.locator(".disc-library")).toHaveAttribute(
      "data-page",
      "1",
    );
  } finally {
    release();
  }
});

test("returning from a pagehide interruption cannot restore an inert entrance", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.locator('.archive-intro[data-phase="spinning"]'),
  ).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  await expect(page.getByLabel("开场动画")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.id.startsWith("archive-")).length,
      ),
    )
    .toBe(0);
  await shelfReady(page);
  await page.locator(".disc-stage").press("ArrowRight");
  await expect(page.locator(".disc-info h2")).toHaveText(
    "ATRI -My Dear Moments-",
  );
});
