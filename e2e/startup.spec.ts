import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(async ({ page }) => {
  const csp = readFileSync("dist/_headers", "utf8")
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith("Content-Security-Policy:"))!
    .trim()
    .slice("Content-Security-Policy:".length)
    .trim();
  // Vite preview does not apply Cloudflare's _headers. Enforce the exact built
  // policy here so a missing/incorrect bootstrap hash cannot pass locally.
  await page.addInitScript(() => {
    (window as any).__startupCspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as any).__startupCspViolations.push({
        directive: event.effectiveDirective,
        blockedURI: event.blockedURI,
      });
    });
  });
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") {
      await route.fallback();
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": csp },
    });
  });
});

test.afterEach(async ({ page }) => {
  expect(
    await page.evaluate(() => (window as any).__startupCspViolations ?? []),
  ).toEqual([]);
});

// Use the production preview: its HTML contains the no-JS catalogue. The dev
// server has an empty root and cannot reproduce a catalogue flashing on startup.
async function holdApplicationScripts(page: Page, resource = "**/assets/*.js") {
  let release!: () => void;
  const requested = new Set<string>();
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(resource, async (route) => {
    requested.add(route.request().url());
    await pending;
    await route.continue().catch(() => {});
  });
  return { release, requested };
}

async function expectLoadingDisc(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-startup", "loading");
  await expect(page.locator("#startup-screen")).toBeVisible();
  await expect(page.locator("#startup-disc")).toBeVisible();
  await expect(page.locator(".static-guide")).toHaveCount(1);
  await expect(page.locator(".static-guide")).toBeHidden();
}

async function expectApplicationReady(page: Page) {
  await expect(page.locator(".disc-hit")).toBeVisible();
  await expect(page.locator("#startup-screen")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-startup");
  await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await expect(page.locator(".disc-info h2")).toBeVisible();
  const stylesheets = page.locator("link[data-startup-style]");
  expect(await stylesheets.count()).toBeGreaterThan(0);
  for (const stylesheet of await stylesheets.all()) {
    await expect(stylesheet).toHaveAttribute("media", "all");
  }
  // Visibility alone accepts the tiny default HTML button when the stylesheet
  // loaded from cache but remained print-only during bootstrap handoff.
  await expect
    .poll(async () => {
      const box = await page.locator(".disc-hit").boundingBox();
      return box ? Math.min(box.width, box.height) : 0;
    })
    .toBeGreaterThan(100);
}

async function expectContinuousHandoff(page: Page) {
  const handoffs = await page.evaluate(() => (window as any).__startupHandoffs);
  expect(handoffs).toHaveLength(1);
  const { from, to } = handoffs[0];
  for (const disc of [from, to]) {
    expect(disc.width).toBeGreaterThan(100);
    expect(disc.height).toBeGreaterThan(100);
    expect(disc.opacity).toBe("1");
    expect(disc.transform).toContain("matrix");
  }
  expect(Math.abs(from.centerX - to.centerX)).toBeLessThan(2);
  expect(Math.abs(from.centerY - to.centerY)).toBeLessThan(2);
  expect(Math.abs(from.width - to.width)).toBeLessThan(2);
}

test("a cold load and refresh show a spinning disc before application scripts arrive", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    (window as any).__startupHandoffs = [];
    window.addEventListener(
      "archive:ready",
      () => {
        const from = document.getElementById("startup-disc");
        const to = document.querySelector(".disc-hit > .disc-face");
        if (!from || !to) return;
        const snapshot = (disc: Element) => {
          const rect = disc.getBoundingClientRect();
          const style = getComputedStyle(disc);
          return {
            centerX: rect.x + rect.width / 2,
            centerY: rect.y + rect.height / 2,
            width: rect.width,
            height: rect.height,
            opacity: style.opacity,
            transform: style.transform,
          };
        };
        (window as any).__startupHandoffs.push({
          from: snapshot(from),
          to: snapshot(to),
        });
      },
      { capture: true },
    );
  });
  const gate = await holdApplicationScripts(page);
  try {
    // DOMContentLoaded waits for modules; commit lets us inspect the actual
    // first paint while those requests are still deliberately unresolved.
    await page.goto("/", { waitUntil: "commit" });
    await expectLoadingDisc(page);
    const rotating = await page
      .locator("#startup-disc")
      .evaluate(async (disc) => {
        const before = getComputedStyle(disc).transform;
        await new Promise((resolve) => setTimeout(resolve, 130));
        return {
          before,
          after: getComputedStyle(disc).transform,
          running: disc
            .getAnimations()
            .some((animation) => animation.playState === "running"),
        };
      });
    expect(rotating.running).toBe(true);
    expect(rotating.after).not.toBe(rotating.before);
    gate.release();
    await expectApplicationReady(page);
    await expectContinuousHandoff(page);
  } finally {
    gate.release();
  }

  const refreshGate = await holdApplicationScripts(page);
  try {
    await page.reload({ waitUntil: "commit" });
    await expectLoadingDisc(page);
    refreshGate.release();
    await expectApplicationReady(page);
    await expectContinuousHandoff(page);
  } finally {
    refreshGate.release();
  }
});

test("a failed application download exposes readable guides and a normal retry link", async ({
  page,
}) => {
  await page.route("**/assets/*.js", (route) => route.abort("failed"));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#startup-failure")).toBeVisible();
  await expect(page.locator(".static-guide")).toBeVisible();
  await expect(
    page.locator('.static-guide a[href^="/guides/"]').first(),
  ).toBeVisible();
  await expect(page.locator("#startup-screen")).toBeHidden();
  await expect(page.locator('#startup-failure a[href=""]')).toBeVisible();
});

test("the loading disc paints while application styles are still downloading", async ({
  page,
}) => {
  const gate = await holdApplicationScripts(page, "**/assets/*.css");
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expectLoadingDisc(page);
    await expect(page.locator(".disc-hit")).toHaveCount(0);
    gate.release();
    await expectApplicationReady(page);
  } finally {
    gate.release();
  }
});

for (const selection of ["query", "history"] as const) {
  test(`a second-page work selected by ${selection} keeps its artwork across delayed script and style loading`, async ({
    page,
  }) => {
    const gameId = "dracu-riot";
    if (selection === "history") {
      await page.addInitScript((gameId) => {
        history.replaceState({ galgameLibrarySelection: gameId }, "");
      }, gameId);
    }
    const gate = await holdApplicationScripts(page, "**/assets/*.{js,css}");
    try {
      await page.goto(selection === "query" ? `/?game=${gameId}` : "/", {
        waitUntil: "commit",
      });
      await expectLoadingDisc(page);
      await expect
        .poll(() => [...gate.requested].some((url) => url.endsWith(".css")))
        .toBe(true);
      await expect
        .poll(() => [...gate.requested].some((url) => url.endsWith(".js")))
        .toBe(true);
      const initialArtwork = await page
        .locator("#startup-disc .startup-art")
        .evaluate((art) => getComputedStyle(art).backgroundImage);
      expect(initialArtwork).toContain(gameId);
      gate.release();
      await expectApplicationReady(page);
      await expect(page.locator(".disc-hit > .disc-face")).toHaveAttribute(
        "data-game-id",
        gameId,
      );
      const finalArtwork = await page
        .locator(".disc-hit > .disc-face img")
        .evaluate((image: HTMLImageElement) => image.src);
      expect(initialArtwork).toBe(`url("${finalArtwork}")`);
      await expect(
        page.locator('.disc-pagination [aria-current="page"]'),
      ).toHaveAttribute("aria-label", "第 2 页作品");
    } finally {
      gate.release();
    }
  });
}

test("a failed stylesheet restores readable content instead of mounting an unstyled application", async ({
  page,
}) => {
  await page.route("**/assets/*.css", (route) => route.abort("failed"));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#startup-failure")).toBeVisible();
  await expect(page.locator(".static-guide")).toBeVisible();
  await expect(page.locator("#startup-screen")).toBeHidden();
  await expect(page.locator(".disc-hit")).toHaveCount(0);
});

test("a stalled download releases the fallback and can still recover when scripts arrive", async ({
  page,
}) => {
  await page.clock.install();
  const gate = await holdApplicationScripts(page);
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expectLoadingDisc(page);
    await page.clock.fastForward(12_100);
    await expect(page.locator("#startup-failure")).toBeVisible();
    await expect(page.locator(".static-guide")).toBeVisible();
    await expect(page.locator("#startup-screen")).toBeHidden();
    gate.release();
    await expectApplicationReady(page);
    await expect(page.locator("#startup-failure")).toHaveCount(0);
  } finally {
    gate.release();
  }
});

test("the static catalogue remains readable when JavaScript is disabled", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".static-guide")).toBeVisible();
    await expect(
      page.locator('.static-guide a[href^="/guides/"]').first(),
    ).toBeVisible();
    await expect(page.locator("#startup-screen")).toBeHidden();
    await expect(page.locator("#startup-failure")).toBeHidden();
  } finally {
    await context.close();
  }
});

test("a direct public guide stays readable while application scripts are delayed", async ({
  page,
}) => {
  const gate = await holdApplicationScripts(page);
  try {
    await page.goto("/guides/white-album-2/wa2-pc-coda-kazusa/1/kazusa-true/", {
      waitUntil: "commit",
    });
    await expect(page.locator(".static-guide")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "冬马和纱",
    );
    await expect(page.locator(".tree-step")).toHaveCount(14);
    await expect(page.locator("#startup-screen")).toBeHidden();
    gate.release();
    await expect(
      page.getByRole("heading", { name: /冬马和纱.*路线树/ }),
    ).toBeVisible();
    await expect(page.locator(".static-guide")).toHaveCount(0);
    await expect(page.locator("main")).not.toHaveAttribute("inert");
  } finally {
    gate.release();
  }
});

test("reduced motion applies before the application bundle loads", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const gate = await holdApplicationScripts(page);
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expectLoadingDisc(page);
    expect(
      await page
        .locator("#startup-screen")
        .evaluate(
          (screen) =>
            screen
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === "running").length,
        ),
    ).toBe(0);
    gate.release();
    await expectApplicationReady(page);
    expect(
      await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.id.startsWith("archive-")).length,
      ),
    ).toBe(0);
  } finally {
    gate.release();
  }
});
