import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const metadata = JSON.parse(readFileSync("src/gallery-metadata.json", "utf8"));

test("scrolling fades the outgoing caption without swapping text or flashing between wheel events", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 5000 });
  const original = await page.locator(".disc-info h2").textContent();
  const originalCredits = await page.locator(".disc-credits").textContent();
  const samples = await page.evaluate(async () => {
    const stage = document.querySelector(".disc-stage")!;
    const caption = document.querySelector(".disc-info")!;
    const credits = document.querySelector(".disc-credits")!;
    const samples: {
      text: string | null;
      opacity: number;
      shift: number;
      credits: string | null;
      creditsOpacity: number;
    }[] = [];
    const start = performance.now();
    stage.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 50, cancelable: true }),
    );
    await new Promise<void>((resolve) => {
      const sample = () => {
        samples.push({
          text: caption.querySelector("h2")!.textContent,
          opacity: Number(getComputedStyle(caption).opacity),
          shift: new DOMMatrix(getComputedStyle(caption).transform).m42,
          credits: credits.textContent,
          creditsOpacity: Number(getComputedStyle(credits).opacity),
        });
        if (performance.now() - start < 350) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return samples;
  });
  expect(samples.every((sample) => sample.text === original)).toBe(true);
  expect(samples.every((sample) => sample.credits === originalCredits)).toBe(
    true,
  );
  expect(
    samples.some(
      (sample) => sample.creditsOpacity > 0 && sample.creditsOpacity < 1,
    ),
  ).toBe(true);
  expect(
    samples.some((sample) => sample.opacity > 0 && sample.opacity < 1),
  ).toBe(true);
  expect(samples.some((sample) => sample.shift > 0 && sample.shift < 8)).toBe(
    true,
  );
  // Keep the gesture cadence in the browser; runner IPC delays must not become user pauses.
  const continuous = await page.evaluate(async () => {
    const stage = document.querySelector(".disc-stage")!;
    const shelf = document.querySelector(".disc-library")!;
    const caption = document.querySelector(".disc-info")!;
    const states: { browsing: string | null; opacity: number }[] = [];
    for (let n = 0; n < 4; n++) {
      stage.dispatchEvent(
        new WheelEvent("wheel", { deltaY: 50, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (n > 0)
        states.push({
          browsing: shelf.getAttribute("data-browsing"),
          opacity: Number(getComputedStyle(caption).opacity),
        });
    }
    return states;
  });
  expect(
    continuous.every(
      (state) => state.browsing === "true" && state.opacity === 0,
    ),
  ).toBe(true);
  const selected = (await page
    .locator(".disc-hit")
    .getAttribute("aria-label"))!.replace("打开当前光盘：", "");
  await expect(page.locator(".disc-info h2")).toHaveText(selected);
  await expect
    .poll(() =>
      page.locator(".disc-info").evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe("1");
});

test("wheel activity hides the UI until the disc settles, then exposes a sourced caption", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 5000 });
  const shelf = page.locator(".disc-library");
  await page
    .locator(".disc-stage")
    .evaluate((el) =>
      el.dispatchEvent(
        new WheelEvent("wheel", { deltaY: 50, cancelable: true }),
      ),
    );
  await expect(shelf).toHaveAttribute("data-browsing", "true");
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".disc-info")).toBeHidden();
  await expect(shelf).toHaveAttribute("data-browsing", "false");
  await expect(page.locator(".disc-info h2")).toHaveText(
    "ATRI -My Dear Moments-",
  );
  await expect(page.locator(".disc-credits")).toContainText("Frontwing × 枕");
  await expect(page.locator(".disc-credits")).toContainText("2020");
  await expect(page.locator(".disc-rating")).toHaveAttribute(
    "href",
    metadata.atri.url,
  );
  await expect(page.locator(".disc-rating strong")).toHaveText(
    metadata.atri.score.toFixed(1),
  );
  const caption = await page.locator(".disc-info").boundingBox();
  const disc = await page.locator(".disc-hit").boundingBox();
  // The rotated square's bounds include empty corners outside the circular artwork.
  expect(caption!.y).toBeGreaterThan(disc!.y + disc!.height * 0.8);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
});

test("page changes flip the disc, keep eight works mounted and restore the selected page after opening a guide", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByLabel("开场动画")).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator(".optical-disc")).toHaveCount(8);
  const first = await page.locator(".disc-info h2").textContent();
  const pagination = page.locator(".disc-pagination");
  await expect(pagination.locator(".page-dot")).toHaveCount(2);
  await expect(pagination).toHaveText("");
  await expect(
    page.getByRole("button", { name: "第 1 页作品", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "第 2 页作品", exact: true }).click();
  await expect(page.locator(".disc-library")).toHaveAttribute(
    "data-flight",
    "out",
  );
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".disc-library")).toHaveAttribute("data-page", "2");
  await expect(
    page.getByRole("button", { name: "第 2 页作品", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".disc-library")).toHaveAttribute(
    "data-flight",
    "idle",
  );
  await expect(page.locator(".disc-info h2")).not.toHaveText(first!);
  await expect(page.locator(".optical-disc")).toHaveCount(8);
  const next = await page.locator(".disc-info h2").textContent();
  await page.getByRole("button", { name: /查看攻略/ }).click();
  await page.getByRole("button", { name: "返回游戏库", exact: true }).click();
  await expect(page.locator(".disc-library")).toHaveAttribute("data-page", "2");
  await expect(page.locator(".disc-info h2")).toHaveText(next!);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".disc-stage").press("PageUp");
  await expect(page.locator(".disc-library")).toHaveAttribute("data-page", "1");
  await expect(page.locator(".disc-library")).toHaveAttribute(
    "data-flight",
    "idle",
  );
  expect(errors).toEqual([]);
});
