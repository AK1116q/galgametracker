import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const metadata = JSON.parse(readFileSync("src/gallery-metadata.json", "utf8"));

test("scrolling fades the outgoing caption without swapping text or flashing between wheel events", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "跳过动画" }).click();
  const original = await page.locator(".disc-info h2").textContent();
  const samples = await page.evaluate(async () => {
    const stage = document.querySelector(".disc-stage")!;
    const caption = document.querySelector(".disc-info")!;
    const samples: { text: string | null; opacity: number }[] = [];
    const start = performance.now();
    stage.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 50, cancelable: true }),
    );
    await new Promise<void>((resolve) => {
      const sample = () => {
        samples.push({
          text: caption.querySelector("h2")!.textContent,
          opacity: Number(getComputedStyle(caption).opacity),
        });
        if (performance.now() - start < 350) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });
    return samples;
  });
  expect(samples.every((sample) => sample.text === original)).toBe(true);
  expect(
    samples.some((sample) => sample.opacity > 0 && sample.opacity < 1),
  ).toBe(true);
  for (let n = 0; n < 3; n++) {
    await page
      .locator(".disc-stage")
      .evaluate((el) =>
        el.dispatchEvent(
          new WheelEvent("wheel", { deltaY: 50, cancelable: true }),
        ),
      );
    await page.waitForTimeout(180);
    await expect(page.locator(".disc-library")).toHaveAttribute(
      "data-browsing",
      "true",
    );
    await expect(page.locator(".disc-info")).toBeHidden();
  }
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
  await page.getByRole("button", { name: "跳过动画" }).click();
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
  await page.getByRole("button", { name: "跳过动画" }).click();
  await expect(page.locator(".optical-disc")).toHaveCount(8);
  const first = await page.locator(".disc-info h2").textContent();
  await page.getByRole("button", { name: "下一页作品", exact: true }).click();
  await expect(page.locator(".disc-library")).toHaveAttribute(
    "data-flight",
    "out",
  );
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".disc-library")).toHaveAttribute("data-page", "2");
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
