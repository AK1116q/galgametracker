import { expect, test } from "@playwright/test";

test("the selected disc spins, slows to a stop in place and replays on refresh", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("开场动画")).toBeVisible();
  await expect(
    page.locator('.archive-intro[data-phase="spinning"]'),
  ).toBeVisible();
  const face = page.locator(".disc-hit > .disc-face");
  const motion = await face.evaluate(async (element: HTMLElement) => {
    const src = element.querySelector("img")!.src;
    const animation = element
      .getAnimations()
      .find((item) => item.id === "archive-spin")!;
    const samples: { time: number; angle: number }[] = [];
    await new Promise<void>((resolve) => {
      const sample = () => {
        if (!document.querySelector(".archive-intro")) return resolve();
        const matrix = new DOMMatrixReadOnly(
          getComputedStyle(element).transform,
        );
        samples.push({
          time: Number(animation.currentTime),
          angle: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
        });
        requestAnimationFrame(sample);
      };
      sample();
    });
    const speeds = samples.slice(1).map((sample, index) => {
      const previous = samples[index];
      let delta = sample.angle - previous.angle;
      if (delta < -180) delta += 360;
      if (delta > 180) delta -= 360;
      return {
        time: sample.time,
        speed: Math.abs(delta) / Math.max(1, sample.time - previous.time),
      };
    });
    const average = (from: number, to: number) => {
      const window = speeds.filter(
        (item) => item.time > from && item.time < to,
      );
      return (
        window.reduce((sum, item) => sum + item.speed, 0) /
        Math.max(1, window.length)
      );
    };
    return {
      earlySpeed: average(100, 900),
      lateSpeed: average(2100, 2500),
      sameDisc: document.querySelector(".disc-hit > .disc-face") === element,
      sameArtwork: element.querySelector("img")!.src === src,
      transform: getComputedStyle(element).transform,
      animationsLeft: document
        .getAnimations()
        .filter((item) => item.id.startsWith("archive-")).length,
    };
  });
  expect(motion.earlySpeed).toBeGreaterThan(motion.lateSpeed * 4);
  expect(motion.lateSpeed).toBeGreaterThan(0);
  expect(motion.sameDisc).toBe(true);
  expect(motion.sameArtwork).toBe(true);
  expect(motion.transform).toBe("none");
  expect(motion.animationsLeft).toBe(0);
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await expect(page.locator(".disc-info h2")).toBeVisible();
  await expect(page.locator(".archive-glyph-rain")).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("开场动画")).toBeVisible();
  await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 4000 });
});

test("reduced motion opens directly without spinning or an input lock", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByLabel("开场动画")).toHaveCount(0);
  await expect(page.locator(".disc-hit")).toBeVisible();
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((item) => item.id.startsWith("archive-")).length,
    ),
  ).toBe(0);
});

test("backgrounding pauses the entrance and resumes without skipping its finish", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.locator('.archive-intro[data-phase="spinning"]'),
  ).toBeVisible();
  const paused = await page.evaluate(async () => {
    const animation = document
      .getAnimations()
      .find((item) => item.id === "archive-spin")!;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const before = Number(animation.currentTime);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const after = Number(animation.currentTime);
    const playState = animation.playState;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    return { before, after, playState };
  });
  expect(paused.playState).toBe("paused");
  expect(Math.abs(paused.after - paused.before)).toBeLessThan(1);
  await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator("main")).not.toHaveAttribute("inert");
});
